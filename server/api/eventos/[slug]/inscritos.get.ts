import { type InscritosDoEvento, totaisDeObentoPorDia } from '~~/shared/evento'
import { estaFiliado } from '~~/shared/filiacao'

/**
 * Lista de inscritos, para a diretoria.
 *
 * Mostra se cada pessoa está filiada: estar filiado não é condição para se
 * inscrever, mas a diretoria precisa saber.
 */
export default defineEventHandler(async (event): Promise<InscritosDoEvento> => {
  await exigirDiretoria(event)
  const slug = getRouterParam(event, 'slug')!
  const prisma = usePrisma()

  const evento = await prisma.evento.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: {
      id: true,
      titulo: true,
      slug: true,
      ofereceAlojamento: true,
      valorAlojamento: true,
      valorObento: true,
      diasObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
      inscricoes: {
        orderBy: { praticante: { nomeCompleto: 'asc' } },
        select: {
          alojamento: true,
          subeventos: { select: { subeventoId: true } },
          obentos: { select: { dia: true, quantidade: true } },
          praticante: {
            select: {
              id: true,
              nomeCompleto: true,
              filiacoes: { select: { inicioEm: true, fimEm: true } },
            },
          },
        },
      },
    },
  })
  if (!evento) throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.' })

  const subeventos = evento.subeventos.map(subeventoDetalhado)

  const inscritos = evento.inscricoes.map((inscricao) => {
    const detalhada = inscricaoComTotal(inscricao, evento, subeventos)
    return {
      praticanteId: inscricao.praticante.id,
      nome: inscricao.praticante.nomeCompleto,
      filiado: estaFiliado(inscricao.praticante.filiacoes),
      ...detalhada,
    }
  })

  const totalEmCentavos = inscritos.reduce((soma, i) => soma + Math.round(i.total * 100), 0)

  return {
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      slug: evento.slug,
      ofereceAlojamento: evento.ofereceAlojamento,
      diasObento: diasComoTexto(evento.diasObento),
    },
    subeventos,
    inscritos,
    totaisDeObento: totaisDeObentoPorDia(inscritos.map(i => ({
      obentos: Object.entries(i.obentos).map(([dia, quantidade]) => ({ dia, quantidade })),
    }))),
    comAlojamento: inscritos.filter(i => i.alojamento).length,
    total: totalEmCentavos / 100,
  }
})
