import { aluguelAberto, problemasParaDevolver } from '~~/shared/aluguel'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const itemId = getRouterParam(event, 'id')!
  const corpo = await readBody(event)
  const voltar = `/itens/${itemId}`
  const prisma = usePrisma()

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { alugueis: true },
  })

  if (!item) return responderErro(event, ['Item não encontrado.'], voltar)

  if (texto(corpo.acao) === 'devolver') {
    const aberto = aluguelAberto(item.alugueis)
    if (!aberto) return responderErro(event, ['Este item não está alugado.'], voltar)

    const fimEm = dataUtc(corpo.fimEm) ?? new Date()
    const problemas = problemasParaDevolver({ inicioEm: aberto.inicioEm, fimEm })
    if (problemas.length > 0) return responderErro(event, problemas, voltar)

    await prisma.aluguel.update({
      where: { id: aberto.id },
      data: { fimEm, observacao: opcional(corpo.observacao) ?? aberto.observacao },
    })

    return responderSucesso(event, voltar)
  }

  const praticanteId = texto(corpo.praticanteId)
  if (!praticanteId) return responderErro(event, ['Escolha o praticante.'], voltar)

  const problemas = await criarAluguel({
    praticanteId,
    itemId,
    valorMensal: Number(item.valorMensalAluguel),
    inicioEm: dataUtc(corpo.inicioEm) ?? new Date(),
    observacao: opcional(corpo.observacao),
  })

  return problemas.length > 0
    ? responderErro(event, problemas, voltar)
    : responderSucesso(event, voltar)
})
