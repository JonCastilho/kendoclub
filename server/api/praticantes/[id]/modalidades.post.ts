export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = await readBody(event)
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  if (texto(corpo.acao) === 'desvincular') {
    const vinculoId = texto(corpo.vinculoId)

    // O vínculo é apagado, mas as graduações ficam: o histórico de exames é do
    // praticante, e não some porque ele parou de treinar a modalidade.
    await prisma.praticanteModalidade.deleteMany({
      where: { id: vinculoId, praticanteId: id },
    })

    return responderSucesso(event, voltar)
  }

  const modalidadeId = texto(corpo.modalidadeId)
  const desde = dataUtc(corpo.desde) ?? new Date()

  if (!modalidadeId) return responderErro(event, ['Escolha a modalidade.'], voltar)

  try {
    await prisma.praticanteModalidade.create({
      data: { praticanteId: id, modalidadeId, desde },
    })
    return responderSucesso(event, voltar)
  }
  catch (erro) {
    if ((erro as { code?: string })?.code === 'P2002') {
      return responderErro(event, ['Este praticante já faz essa modalidade.'], voltar)
    }
    throw erro
  }
})
