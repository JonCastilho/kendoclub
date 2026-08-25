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

  return {
    ...praticante,
    filiado: estaFiliado(praticante.filiacoes),
    noClubeDesde: primeiraFiliacaoEm(praticante.filiacoes),
    modalidadesComGraduacao: atuais,
    isencaoVigente: praticante.isencoes.find(i => !i.fimEm) ?? null,
  }
})
