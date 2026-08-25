import { estaFiliado, primeiraFiliacaoEm } from '~~/shared/filiacao'
import { graduacaoAtual } from '~~/shared/graduacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const prisma = usePrisma()

  const praticante = await prisma.praticante.findUnique({
    where: { id },
    include: {
      filiacoes: { orderBy: { inicioEm: 'desc' } },
      modalidades: { include: { modalidade: true } },
      graduacoes: { include: { modalidade: true }, orderBy: { obtidaEm: 'desc' } },
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

  // Graduação atual por modalidade: calculada, nunca guardada — campo "grau
  // atual" um dia discorda do histórico.
  const atuais = praticante.modalidades.map((vinculo) => {
    const daModalidade = praticante.graduacoes.filter(
      g => g.modalidadeId === vinculo.modalidadeId)

    return {
      modalidadeId: vinculo.modalidadeId,
      modalidade: vinculo.modalidade.nome,
      kyuInicial: vinculo.modalidade.kyuInicial,
      desde: vinculo.desde,
      graduacaoAtual: graduacaoAtual(daModalidade)?.grau ?? null,
    }
  })

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
