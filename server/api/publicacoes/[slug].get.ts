import { podeVer } from '~~/shared/publicacao'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const leitor = await leitorAtual(event)
  const prisma = usePrisma()

  // Aceita o endereço público (slug) ou o id, que é como a tela de edição
  // encontra a publicação. Os dois são únicos e de formatos distintos, então
  // não há ambiguidade — e evita um segundo endpoint que faria o mesmo.
  const publicacao = await prisma.publicacao.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: { autor: { select: { email: true } } },
  })

  // Mesma resposta para "não existe" e "não pode ver": dizer 403 revelaria que
  // existe um post restrito com aquele endereço.
  if (!publicacao || !podeVer(publicacao, leitor)) {
    throw createError({ statusCode: 404, statusMessage: 'Publicação não encontrada.' })
  }

  return {
    ...publicacao,
    html: markdownParaHtml(publicacao.conteudo),
    podeEditar: leitor.ehDiretoria,
  }
})
