import { rotuloDaGraduacao } from '~~/shared/graduacao'

/**
 * Tira uma graduação do exame.
 *
 * Com inscritos, pede confirmação e diz quantos. Confirmar tira só esse exame
 * da inscrição: quem também presta shogo continua nele; quem prestaria só a
 * graduação sai do exame.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const graduacao = await prisma.graduacaoExame.findUnique({
    where: { id: texto(corpo.id) },
    select: { id: true, grau: true, subeventoId: true, subevento: { select: { eventoId: true } } },
  })
  if (!graduacao) return responderErro(event, ['Graduação não encontrada.'], '/eventos')

  const eventoId = graduacao.subevento.eventoId
  const voltar = `/eventos/${eventoId}`
  const doExame = { subeventoId: graduacao.subeventoId, grauPretendido: graduacao.grau }
  const inscritos = await prisma.inscricaoSubevento.count({ where: doExame })

  if (inscritos > 0 && !marcado(corpo.confirmar)) {
    return responderErro(event, [
      `${inscritos} inscrito(s) prestariam ${rotuloDaGraduacao(graduacao.grau)} e perderão esse exame.`,
      'Marque a confirmação para remover.',
    ], voltar)
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscricaoSubevento.updateMany({ where: doExame, data: { grauPretendido: null } })
    // Quem ficou sem graduação e sem shogo não presta nada neste exame.
    await tx.inscricaoSubevento.deleteMany({
      where: { subeventoId: graduacao.subeventoId, grauPretendido: null, shogoPretendido: null },
    })
    await tx.graduacaoExame.delete({ where: { id: graduacao.id } })
    await recalcularEvento(tx, eventoId)
  })

  return responderSucesso(event, voltar)
})
