import { ROTULO_DO_SHOGO } from '~~/shared/graduacao'

/**
 * Tira o exame de shogo.
 *
 * Com inscritos, pede confirmação. Confirmar tira só o shogo da inscrição: quem
 * também presta o exame de dan continua nele; quem prestaria só o shogo sai do
 * exame.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const oferecido = await prisma.shogoExame.findUnique({
    where: { id: texto(corpo.id) },
    select: { id: true, shogo: true, subeventoId: true, subevento: { select: { eventoId: true } } },
  })
  if (!oferecido) return responderErro(event, ['Shogo não encontrado.'], '/eventos')

  const eventoId = oferecido.subevento.eventoId
  const voltar = `/eventos/${eventoId}`
  const doExame = { subeventoId: oferecido.subeventoId, shogoPretendido: oferecido.shogo }
  const inscritos = await prisma.inscricaoSubevento.count({ where: doExame })

  if (inscritos > 0 && !marcado(corpo.confirmar)) {
    return responderErro(event, [
      `${inscritos} inscrito(s) prestariam ${ROTULO_DO_SHOGO[oferecido.shogo]} e perderão esse exame.`,
      'Marque a confirmação para remover.',
    ], voltar)
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscricaoSubevento.updateMany({ where: doExame, data: { shogoPretendido: null } })
    // Quem ficou sem dan e sem shogo não presta nada neste exame.
    await tx.inscricaoSubevento.deleteMany({
      where: { subeventoId: oferecido.subeventoId, grauPretendido: null, shogoPretendido: null },
    })
    await tx.shogoExame.delete({ where: { id: oferecido.id } })
    await recalcularEvento(tx, eventoId)
  })

  return responderSucesso(event, voltar)
})
