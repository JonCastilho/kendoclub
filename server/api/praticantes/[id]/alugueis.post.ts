import { interpretarValor } from '~~/shared/dinheiro'
import { problemasParaDevolver } from '~~/shared/aluguel'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const praticanteId = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const voltar = `/praticantes/${praticanteId}`
  const prisma = usePrisma()

  if (texto(corpo.acao) === 'devolver') {
    const aluguel = await prisma.aluguel.findFirst({
      where: { id: texto(corpo.aluguelId), praticanteId, fimEm: null },
    })

    if (!aluguel) return responderErro(event, ['Aluguel não encontrado.'], voltar)

    const fimEm = dataUtc(corpo.fimEm) ?? new Date()
    const problemas = problemasParaDevolver({ inicioEm: aluguel.inicioEm, fimEm })
    if (problemas.length > 0) return responderErro(event, problemas, voltar)

    await prisma.aluguel.update({ where: { id: aluguel.id }, data: { fimEm } })
    return responderSucesso(event, voltar)
  }

  const itemId = opcional(corpo.itemId)
  const valorInformado = texto(corpo.valorMensal)
  const valor = valorInformado
    ? interpretarValor(valorInformado)
    : await valorSugerido(itemId)

  if (valor === null) return responderErro(event, ['Valor do aluguel inválido.'], voltar)

  const problemas = await criarAluguel({
    praticanteId,
    itemId,
    descricao: opcional(corpo.descricao),
    valorMensal: valor,
    inicioEm: dataUtc(corpo.inicioEm) ?? new Date(),
    observacao: opcional(corpo.observacao),
  })

  return problemas.length > 0
    ? responderErro(event, problemas, voltar)
    : responderSucesso(event, voltar)
})
