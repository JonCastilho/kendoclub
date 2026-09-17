import { ROTULO_DO_SHOGO, type Shogo } from '~~/shared/graduacao'

/**
 * Tira um título registrado por engano. O Renshi só sai depois do Kyoshi, que
 * depende dele.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  const vinculo = await prisma.praticanteModalidade.findFirst({
    where: { praticanteId: id, modalidadeId: texto(corpo.modalidadeId) },
    select: { id: true, shogos: { select: { shogo: true } } },
  })
  if (!vinculo) return responderErro(event, ['Este praticante não faz essa modalidade.'], voltar)

  const shogo = texto(corpo.shogo) as Shogo
  if (!vinculo.shogos.some(s => s.shogo === shogo)) {
    return responderErro(event, ['Título não encontrado.'], voltar)
  }
  if (shogo === 'RENSHI' && vinculo.shogos.some(s => s.shogo === 'KYOSHI')) {
    return responderErro(event, [`Remova o ${ROTULO_DO_SHOGO.KYOSHI} antes do Renshi.`], voltar)
  }

  await prisma.shogoPraticante.delete({
    where: { praticanteModalidadeId_shogo: { praticanteModalidadeId: vinculo.id, shogo } },
  })
  return responderSucesso(event, voltar)
})
