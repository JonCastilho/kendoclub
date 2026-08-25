import { KYU_MAXIMO } from '~~/shared/graduacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = await readBody(event)
  const voltar = '/modalidades'
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const nome = texto(corpo.nome)
  const kyuInicial = Number(texto(corpo.kyuInicial))
  const ativa = marcado(corpo.ativa)

  if (!nome) return responderErro(event, ['Informe o nome da modalidade.'], voltar)
  if (!Number.isInteger(kyuInicial) || kyuInicial < 1 || kyuInicial > KYU_MAXIMO) {
    return responderErro(event, [`O kyu inicial vai de 1 a ${KYU_MAXIMO}.`], voltar)
  }

  try {
    if (id) {
      await prisma.modalidade.update({ where: { id }, data: { nome, kyuInicial, ativa } })
    }
    else {
      await prisma.modalidade.create({ data: { nome, kyuInicial, ativa } })
    }
    return responderSucesso(event, voltar)
  }
  catch (erro) {
    if ((erro as { code?: string })?.code === 'P2002') {
      return responderErro(event, ['Já existe modalidade com esse nome.'], voltar)
    }
    throw erro
  }
})
