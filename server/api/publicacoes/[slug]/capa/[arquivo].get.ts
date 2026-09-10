import { tipoDaImagem } from '~~/shared/imagem'
import { podeVer } from '~~/shared/publicacao'

/**
 * Entrega a imagem de capa.
 *
 * A imagem não fica na pasta pública de propósito. Arquivo servido como
 * estático não passa por nenhuma checagem, e a foto de uma notícia interna
 * ficaria aberta na internet só porque o endereço dela é outro — o texto
 * protegido e a imagem escancarada. Aqui a capa herda a permissão do post.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const arquivo = getRouterParam(event, 'arquivo')!
  const leitor = await leitorAtual(event)
  const prisma = usePrisma()

  const publicacao = await prisma.publicacao.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { imagemCapa: true, visibilidade: true, publicadaEm: true },
  })

  // O nome pedido no endereço só é comparado; o que abre o arquivo é o valor
  // guardado no banco. Assim nenhum pedaço de caminho escrito por quem acessa
  // chega ao disco, e endereço de capa antiga responde 404 em vez de servir
  // uma imagem que já foi trocada.
  if (!publicacao || !podeVer(publicacao, leitor) || publicacao.imagemCapa !== arquivo) {
    throw createError({ statusCode: 404, statusMessage: 'Imagem não encontrada.' })
  }

  const bytes = await lerCapa(publicacao.imagemCapa)
  const tipo = bytes && tipoDaImagem(bytes)
  if (!bytes || !tipo) {
    throw createError({ statusCode: 404, statusMessage: 'Imagem não encontrada.' })
  }

  setResponseHeaders(event, {
    // O tipo sai da assinatura do arquivo, não do que foi declarado no envio.
    'content-type': tipo,
    // Impede o navegador de adivinhar outro tipo: um arquivo que fosse imagem
    // válida e HTML ao mesmo tempo não vira página dentro do nosso domínio.
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
    // Capa de notícia interna não pode ficar em cache compartilhado no caminho.
    'cache-control': publicacao.visibilidade === 'RESTRITA'
      ? 'private, max-age=31536000, immutable'
      : 'public, max-age=31536000, immutable',
  })

  return bytes
})
