import type { Grau } from '@prisma/client'
import { grauPertenceAModalidade } from '~~/shared/graduacao'

/**
 * Define a graduação atual do praticante numa modalidade.
 *
 * Não há histórico: registrar uma graduação substitui a anterior. É o que o
 * clube precisa — para exame vale o grau vigente e desde quando.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  const modalidadeId = texto(corpo.modalidadeId)
  const grauInformado = texto(corpo.grau)
  const graduadoEm = dataUtc(corpo.graduadoEm)

  const vinculo = await prisma.praticanteModalidade.findFirst({
    where: { praticanteId: id, modalidadeId },
    include: { modalidade: true },
  })

  if (!vinculo) {
    return responderErro(event, ['Este praticante não faz essa modalidade.'], voltar)
  }

  // Campo vazio devolve o praticante a mukyu, que é como se corrige um registro
  // feito por engano.
  if (!grauInformado) {
    await prisma.praticanteModalidade.update({
      where: { id: vinculo.id },
      data: { grau: null, graduadoEm: null, observacoesGraduacao: null },
    })
    return responderSucesso(event, voltar)
  }

  const grau = grauInformado as Grau

  if (!grauPertenceAModalidade(grau, vinculo.modalidade.kyuInicial)) {
    return responderErro(event, [`Grau fora da faixa de ${vinculo.modalidade.nome}.`], voltar)
  }
  if (!graduadoEm) {
    return responderErro(event, ['Informe a data do exame.'], voltar)
  }
  if (graduadoEm > new Date()) {
    return responderErro(event, ['A graduação não pode ter data no futuro.'], voltar)
  }

  await prisma.praticanteModalidade.update({
    where: { id: vinculo.id },
    data: { grau, graduadoEm, observacoesGraduacao: opcional(corpo.observacoes) },
  })

  return responderSucesso(event, voltar)
})
