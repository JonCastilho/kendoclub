import { ROTULO_DO_TIPO, type TipoSubevento, diasDoEvento, formatarDia, problemasDoSubevento } from '~~/shared/evento'

/**
 * Cria ou atualiza um subevento.
 *
 * Os dias chegam como `dia_1`, `dia_2`…: vários campos de data, e não um campo
 * repetido, para a tela funcionar sem JavaScript. Mudar os dias mexe no período
 * do evento, no limite do prazo e nos dias de obento — por isso tudo é conferido
 * antes de gravar.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const eventoId = texto(corpo.eventoId)
  const id = texto(corpo.id)
  const voltar = `/eventos/${eventoId}`

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      prazoInscricao: true,
      diasObento: true,
      subeventos: { select: { id: true, tipo: true, modalidadeId: true, dias: true } },
    },
  })
  if (!evento) return responderErro(event, ['Evento não encontrado.'], '/eventos')

  if (id && !evento.subeventos.some(s => s.id === id)) {
    return responderErro(event, ['Subevento não encontrado.'], voltar)
  }

  const dias = [...new Set(Object.keys(corpo)
    .filter(campo => campo.startsWith('dia_'))
    .map(campo => texto(corpo[campo]))
    .filter(Boolean))].sort()

  const dados = {
    tipo: texto(corpo.tipo),
    modalidadeId: texto(corpo.modalidadeId),
    local: texto(corpo.local),
    dias,
    valor: valorOpcional(corpo.valor),
  }

  const problemas = problemasDoSubevento(dados)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const modalidade = await prisma.modalidade.findUnique({
    where: { id: dados.modalidadeId }, select: { nome: true },
  })
  if (!modalidade) return responderErro(event, ['Modalidade não encontrada.'], voltar)

  const outros = evento.subeventos.filter(s => s.id !== id)

  if (outros.some(s => s.tipo === dados.tipo && s.modalidadeId === dados.modalidadeId)) {
    const tipo = ROTULO_DO_TIPO[dados.tipo as TipoSubevento].toLowerCase()
    return responderErro(event, [`Este evento já tem ${tipo} de ${modalidade.nome}.`], voltar)
  }

  const diasFuturos = diasDoEvento([
    ...outros.map(s => ({ dias: diasComoTexto(s.dias) })),
    { dias },
  ])

  const prazo = diasComoTexto([evento.prazoInscricao])[0]!
  if (prazo > diasFuturos[0]!) {
    return responderErro(event, [
      `O primeiro dia do evento ficaria antes do prazo de inscrição (${formatarDia(prazo)}). `
      + 'Ajuste o prazo antes.',
    ], voltar)
  }

  const obentoAtual = diasComoTexto(evento.diasObento)
  const afetados = await obentosAfetados(
    evento.id, obentoAtual, obentoAtual.filter(dia => diasFuturos.includes(dia)))
  if (afetados.quantidade > 0 && !marcado(corpo.confirmarApagarObentos)) {
    return responderErro(event, [
      avisoDeObentosApagados(afetados), 'Marque a confirmação para seguir.'], voltar)
  }

  const colunas = {
    tipo: dados.tipo as TipoSubevento,
    modalidadeId: dados.modalidadeId,
    local: dados.local,
    dias: dias.map(diaComoData),
    valor: dados.tipo === 'SEMINARIO' ? dados.valor : null,
  }

  await prisma.$transaction(async (tx) => {
    if (id) await tx.subevento.update({ where: { id }, data: colunas })
    else await tx.subevento.create({ data: { ...colunas, eventoId: evento.id } })

    await recalcularEvento(tx, evento.id)
  })

  return responderSucesso(event, voltar)
})
