/**
 * Remove uma categoria.
 *
 * Com inscritos, pede confirmação e diz quantos: confirmar tira essas pessoas
 * da competição, porque competir sem categoria não existe. O resto da inscrição
 * delas — outros subeventos, obento — continua.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const categoria = await prisma.categoriaCompeticao.findUnique({
    where: { id },
    select: { subevento: { select: { eventoId: true } }, _count: { select: { inscricoes: true } } },
  })
  if (!categoria) return responderErro(event, ['Categoria não encontrada.'], '/eventos')

  const eventoId = categoria.subevento.eventoId
  const voltar = `/eventos/${eventoId}`
  const inscritos = categoria._count.inscricoes

  if (inscritos > 0 && !marcado(corpo.confirmar)) {
    return responderErro(event, [
      `Esta categoria tem ${inscritos} inscrito(s), que sairão da competição.`,
      'Marque a confirmação para remover.',
    ], voltar)
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscricaoSubevento.deleteMany({ where: { categoriaId: id } })
    await tx.categoriaCompeticao.delete({ where: { id } })
    // Quem ficou sem subevento perde o alojamento; quem ficou sem nada, a
    // inscrição.
    await recalcularEvento(tx, eventoId)
  })

  return responderSucesso(event, voltar)
})
