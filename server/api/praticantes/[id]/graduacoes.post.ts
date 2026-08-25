import type { Grau } from '@prisma/client'
import { grauPertenceAModalidade } from '~~/shared/graduacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = await readBody(event)
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  if (texto(corpo.acao) === 'remover') {
    await prisma.graduacao.deleteMany({
      where: { id: texto(corpo.graduacaoId), praticanteId: id },
    })
    return responderSucesso(event, voltar)
  }

  const modalidadeId = texto(corpo.modalidadeId)
  const grau = texto(corpo.grau) as Grau
  const obtidaEm = dataUtc(corpo.obtidaEm)

  if (!modalidadeId) return responderErro(event, ['Escolha a modalidade.'], voltar)
  if (!obtidaEm) return responderErro(event, ['Informe a data do exame.'], voltar)
  if (obtidaEm > new Date()) {
    return responderErro(event, ['A graduação não pode ter data no futuro.'], voltar)
  }

  const modalidade = await prisma.modalidade.findUnique({ where: { id: modalidadeId } })
  if (!modalidade) return responderErro(event, ['Modalidade não encontrada.'], voltar)

  // A faixa válida depende da modalidade: uma que começa no 5º kyu não tem 6º.
  if (!grauPertenceAModalidade(grau, modalidade.kyuInicial)) {
    return responderErro(
      event,
      [`Grau fora da faixa de ${modalidade.nome}.`],
      voltar,
    )
  }

  await prisma.graduacao.create({
    data: {
      praticanteId: id,
      modalidadeId,
      grau,
      obtidaEm,
      observacoes: opcional(corpo.observacoes),
    },
  })

  return responderSucesso(event, voltar)
})
