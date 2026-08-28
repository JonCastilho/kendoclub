import { competenciaAtual, ehCompetenciaValida } from '~~/shared/competencia'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const { competencia: pedida, situacao } = getQuery(event)
  const competencia = ehCompetenciaValida(String(pedida ?? ''))
    ? String(pedida)
    : competenciaAtual()

  const prisma = usePrisma()

  const mensalidades = await prisma.mensalidade.findMany({
    where: {
      competencia,
      ...(situacao ? { situacao: situacao as never } : {}),
    },
    include: {
      praticante: { select: { id: true, nomeCompleto: true } },
      linhas: { orderBy: { tipo: 'asc' } },
      declaracoes: { orderBy: { criadoEm: 'desc' } },
      baixadaPor: { select: { email: true } },
    },
    orderBy: { praticante: { nomeCompleto: 'asc' } },
  })

  // Os totais consideram a competência inteira, e não o filtro aplicado: a
  // diretoria precisa saber quanto falta entrar, mesmo olhando só os abertos.
  const doMes = situacao
    ? await prisma.mensalidade.findMany({
        where: { competencia },
        select: { situacao: true, valorTotal: true, valorPago: true },
      })
    : mensalidades

  const soma = (lista: Array<{ valorTotal: unknown }>) =>
    lista.reduce((total, m) => total + Number(m.valorTotal), 0)

  const abertas = doMes.filter(m => m.situacao === 'ABERTA')

  // Quantos avisos de pagamento esperam conferência — é a fila que a etapa 5
  // tira do WhatsApp.
  const aConferir = await prisma.declaracaoPagamento.count({
    where: { analisadaEm: null, mensalidade: { competencia } },
  })

  return {
    competencia,
    aConferir,
    total: doMes.length,
    abertas: abertas.length,
    pagas: doMes.filter(m => m.situacao === 'PAGA').length,
    isentas: doMes.filter(m => m.situacao === 'ISENTA').length,
    valorEsperado: soma(doMes),
    valorEmAberto: soma(abertas),
    mensalidades,
  }
})
