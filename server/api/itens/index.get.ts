import { aluguelAberto } from '~~/shared/aluguel'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const { situacao } = getQuery(event)
  const prisma = usePrisma()

  const itens = await prisma.item.findMany({
    orderBy: [{ nome: 'asc' }, { identificador: 'asc' }],
    include: {
      alugueis: {
        where: { fimEm: null },
        include: { praticante: { select: { id: true, nomeCompleto: true } } },
      },
    },
  })

  const comSituacao = itens.map((item) => {
    const aberto = aluguelAberto(item.alugueis)
    return {
      id: item.id,
      nome: item.nome,
      identificador: item.identificador,
      tipo: item.tipo,
      situacao: item.situacao,
      valorMensalAluguel: item.valorMensalAluguel,
      alugado: aberto !== null,
      comQuem: aberto?.praticante ?? null,
      desde: aberto?.inicioEm ?? null,
    }
  })

  // "Alugado" não é campo, é consequência de haver aluguel aberto — por isso o
  // filtro acontece aqui.
  const filtrados = situacao === 'ALUGADOS'
    ? comSituacao.filter(i => i.alugado)
    : situacao === 'DISPONIVEIS'
      ? comSituacao.filter(i => !i.alugado && i.situacao === 'DISPONIVEL')
      : comSituacao

  return {
    total: filtrados.length,
    alugados: comSituacao.filter(i => i.alugado).length,
    disponiveis: comSituacao.filter(i => !i.alugado && i.situacao === 'DISPONIVEL').length,
    itens: filtrados,
  }
})
