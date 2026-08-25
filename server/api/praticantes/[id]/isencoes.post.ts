export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = await readBody(event)
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  if (texto(corpo.acao) === 'encerrar') {
    const fimEm = dataUtc(corpo.fimEm) ?? new Date()

    await prisma.isencao.updateMany({
      where: { id: texto(corpo.isencaoId), praticanteId: id, fimEm: null },
      data: { fimEm },
    })

    return responderSucesso(event, voltar)
  }

  const inicioEm = dataUtc(corpo.inicioEm)
  const motivo = texto(corpo.motivo)

  if (!inicioEm) return responderErro(event, ['Informe o início da isenção.'], voltar)
  // Isenção mexe em dinheiro: sem motivo registrado, ninguém consegue explicar
  // depois por que aquele praticante deixou de pagar.
  if (!motivo) return responderErro(event, ['Descreva o motivo da isenção.'], voltar)

  const jaTem = await prisma.isencao.count({ where: { praticanteId: id, fimEm: null } })
  if (jaTem > 0) {
    return responderErro(event, ['Este praticante já tem uma isenção vigente.'], voltar)
  }

  await prisma.isencao.create({
    data: {
      praticanteId: id,
      inicioEm,
      fimEm: dataUtc(corpo.fimEm),
      motivo,
      // Quem concedeu fica registrado, como na baixa de pagamento.
      concedidaPorUsuarioId: usuario.id,
    },
  })

  return responderSucesso(event, voltar)
})
