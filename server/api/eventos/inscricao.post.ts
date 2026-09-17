import {
  diaDe,
  ehDiaValido,
  formatarDia,
  hojeNoFuso,
  inscricoesAbertas,
  normalizarInscricao,
} from '~~/shared/evento'
import { podeVer } from '~~/shared/publicacao'

/**
 * Grava a inscrição inteira de um praticante num evento.
 *
 * O formulário manda o estado completo — subeventos marcados (`subevento_<id>`),
 * alojamento e quantidade de obento por dia (`obento_<dia>`) — e o servidor faz
 * a inscrição ficar igual a ele. Estado vazio é desistência.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()
  const ehDiretoria = usuario.papel === 'DIRETORIA'

  const evento = await prisma.evento.findUnique({
    where: { id: texto(corpo.eventoId) },
    select: {
      id: true,
      slug: true,
      visibilidade: true,
      publicadoEm: true,
      prazoInscricao: true,
      ofereceAlojamento: true,
      diasObento: true,
      subeventos: { select: { id: true } },
    },
  })

  const visivel = evento && podeVer(
    { visibilidade: evento.visibilidade, publicadaEm: evento.publicadoEm },
    { logado: true, ehDiretoria },
  )
  if (!evento || !visivel) return responderErro(event, ['Evento não encontrado.'], '/agenda')

  // Só a diretoria inscreve outra pessoa. Praticante que mande o id de outro
  // recebe 403, e não uma inscrição feita em silêncio na própria conta.
  const pedido = texto(corpo.praticanteId)
  if (pedido && !ehDiretoria && pedido !== usuario.praticanteId) {
    throw createError({ statusCode: 403, statusMessage: 'Só a diretoria inscreve outra pessoa.' })
  }
  const praticanteId = pedido || usuario.praticanteId

  const proprio = praticanteId === usuario.praticanteId
  const voltar = `/agenda/${evento.slug}${proprio ? '' : `?praticante=${praticanteId}`}`

  if (!praticanteId) {
    return responderErro(event, ['Sua conta não está ligada a um praticante.'], voltar)
  }

  const praticante = await prisma.praticante.findUnique({
    where: { id: praticanteId }, select: { id: true },
  })
  if (!praticante) return responderErro(event, ['Praticante não encontrado.'], `/agenda/${evento.slug}`)

  const prazo = diaDe(evento.prazoInscricao)
  if (!ehDiretoria && !inscricoesAbertas(prazo, hojeNoFuso(await fusoDoClube()))) {
    return responderErro(event, [`As inscrições encerraram em ${formatarDia(prazo)}.`], voltar)
  }

  const campos = Object.keys(corpo)
  const obentos: Record<string, number> = {}
  for (const campo of campos.filter(c => c.startsWith('obento_'))) {
    const dia = campo.slice('obento_'.length)
    if (!ehDiaValido(dia)) continue
    const bruto = texto(corpo[campo])
    obentos[dia] = bruto === '' ? 0 : Number(bruto)
  }

  const { inscricao, problemas, vazia } = normalizarInscricao({
    subeventoIds: campos
      .filter(c => c.startsWith('subevento_') && marcado(corpo[c]))
      .map(c => c.slice('subevento_'.length)),
    alojamento: marcado(corpo.alojamento),
    obentos,
  }, {
    subeventoIds: evento.subeventos.map(s => s.id),
    ofereceAlojamento: evento.ofereceAlojamento,
    diasObento: diasComoTexto(evento.diasObento),
  })

  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const chave = { eventoId_praticanteId: { eventoId: evento.id, praticanteId } }

  await prisma.$transaction(async (tx) => {
    if (vazia) {
      await tx.inscricaoEvento.deleteMany({ where: { eventoId: evento.id, praticanteId } })
      return
    }

    const gravada = await tx.inscricaoEvento.upsert({
      where: chave,
      create: {
        eventoId: evento.id,
        praticanteId,
        alojamento: inscricao.alojamento,
        inscritoPorUsuarioId: usuario.id,
      },
      update: { alojamento: inscricao.alojamento, inscritoPorUsuarioId: usuario.id },
      select: { id: true },
    })

    await tx.inscricaoSubevento.deleteMany({
      where: { inscricaoEventoId: gravada.id, subeventoId: { notIn: inscricao.subeventoIds } },
    })
    await tx.inscricaoSubevento.createMany({
      data: inscricao.subeventoIds.map(subeventoId => ({ inscricaoEventoId: gravada.id, subeventoId })),
      skipDuplicates: true,
    })

    await tx.encomendaObento.deleteMany({ where: { inscricaoEventoId: gravada.id } })
    await tx.encomendaObento.createMany({
      data: Object.entries(inscricao.obentos).map(([dia, quantidade]) => ({
        inscricaoEventoId: gravada.id, dia: diaComoData(dia), quantidade,
      })),
    })
  })

  return responderSucesso(event, voltar)
})
