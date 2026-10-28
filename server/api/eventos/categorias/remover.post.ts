/**
 * Remove uma categoria.
 *
 * Com inscritos, pede confirmação e diz quantos. Confirmar tira só aquela
 * disputa da inscrição: quem também compete na outra continua nela; quem
 * competiria só na categoria removida sai da competição. O resto da inscrição —
 * outros subeventos, obento — continua.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const categoria = await prisma.categoriaCompeticao.findUnique({
    where: { id },
    select: {
      subeventoId: true,
      subevento: { select: { eventoId: true } },
      _count: { select: { inscricoesIndividuais: true, inscricoesDeEquipe: true } },
    },
  })
  if (!categoria) return responderErro(event, ['Categoria não encontrada.'], '/eventos')

  const eventoId = categoria.subevento.eventoId
  const voltar = `/eventos/${eventoId}`
  const inscritos = categoria._count.inscricoesIndividuais + categoria._count.inscricoesDeEquipe

  if (inscritos > 0 && !marcado(corpo.confirmar)) {
    return responderErro(event, [
      `Esta categoria tem ${inscritos} inscrito(s), que perderão essa disputa.`,
      'Marque a confirmação para remover.',
    ], voltar)
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscricaoSubevento.updateMany({
      where: { categoriaIndividualId: id }, data: { categoriaIndividualId: null },
    })
    await tx.inscricaoSubevento.updateMany({
      where: { categoriaEquipeId: id }, data: { categoriaEquipeId: null },
    })
    // Quem ficou sem categoria em qualquer disputa não compete mais.
    await tx.inscricaoSubevento.deleteMany({
      where: { subeventoId: categoria.subeventoId, categoriaIndividualId: null, categoriaEquipeId: null },
    })
    await tx.categoriaCompeticao.delete({ where: { id } })
    // Quem ficou sem subevento perde o alojamento; quem ficou sem nada, a
    // inscrição.
    await recalcularEvento(tx, eventoId)
  })

  return responderSucesso(event, voltar)
})
