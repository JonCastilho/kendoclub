import { estaFiliado, primeiraFiliacaoEm } from '~~/shared/filiacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const prisma = usePrisma()

  const praticante = await prisma.praticante.findUnique({
    where: { id },
    include: {
      usuario: { select: { email: true, ativo: true, ultimoAcessoEm: true } },
      filiacoes: { orderBy: { inicioEm: 'desc' } },
      modalidades: { include: { modalidade: true }, orderBy: { desde: 'asc' } },
      isencoes: { orderBy: { inicioEm: 'desc' } },
      alugueis: {
        orderBy: { inicioEm: 'desc' },
        include: { item: { select: { id: true, nome: true, identificador: true } } },
      },
    },
  })

  if (!praticante) {
    throw createError({ statusCode: 404, statusMessage: 'Praticante não encontrado.' })
  }

  // A graduação mora no próprio vínculo: um registro por modalidade, sem
  // histórico. Nulo é mukyu.
  const atuais = praticante.modalidades.map(vinculo => ({
    vinculoId: vinculo.id,
    modalidadeId: vinculo.modalidadeId,
    modalidade: vinculo.modalidade.nome,
    kyuInicial: vinculo.modalidade.kyuInicial,
    desde: vinculo.desde,
    grau: vinculo.grau,
    graduadoEm: vinculo.graduadoEm,
    observacoesGraduacao: vinculo.observacoesGraduacao,
  }))

  // Itens livres para vincular, e o valor sugerido do clube: o aluguel também
  // nasce aqui, para o dojo que não cadastra item nenhum.
  const [itensLivres, clube] = await Promise.all([
    prisma.item.findMany({
      where: { situacao: 'DISPONIVEL', alugueis: { none: { fimEm: null } } },
      select: { id: true, nome: true, identificador: true, valorMensalAluguel: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.configuracaoClube.findUnique({
      where: { id: 1 },
      select: { valorAluguelPadrao: true },
    }),
  ])

  return {
    ...praticante,
    itensLivres,
    valorAluguelPadrao: clube?.valorAluguelPadrao ?? 0,
    alugueisAbertos: praticante.alugueis.filter(a => !a.fimEm),
    filiado: estaFiliado(praticante.filiacoes),
    noClubeDesde: primeiraFiliacaoEm(praticante.filiacoes),
    modalidadesComGraduacao: atuais,
    isencaoVigente: praticante.isencoes.find(i => !i.fimEm) ?? null,
  }
})
