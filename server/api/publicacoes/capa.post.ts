import { LIMITE_BYTES, problemasDaImagem, tipoDaImagem } from '~~/shared/imagem'

/**
 * Troca ou remove a imagem de capa.
 *
 * Fica em rota própria porque é o único formulário do sistema que envia
 * multipart — o resto é urlencoded. Separar também deixa o formulário de texto
 * intacto: corrigir o título não reenvia a foto.
 *
 * A capa só existe depois que a publicação existe. É consequência de o arquivo
 * precisar de um dono no banco, e combina com o resto da tela: escrever,
 * ilustrar e publicar são três atos.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const prisma = usePrisma()

  // Recusa pelo cabeçalho antes de ler o corpo. Sem isto, um envio de 500 MB
  // seria inteiro carregado na memória só para depois ser rejeitado.
  const declarado = Number(getHeader(event, 'content-length') ?? 0)
  if (declarado > LIMITE_BYTES + 64 * 1024) {
    return responderErro(event, problemasDaImagem(new Uint8Array(LIMITE_BYTES + 1)), '/publicacoes')
  }

  const partes = (await readMultipartFormData(event)) ?? []
  const campo = (nome: string) =>
    partes.find(p => p.name === nome && !p.filename)?.data.toString('utf8').trim() ?? ''

  const id = campo('id')
  const voltar = `/publicacoes/${id}`

  const publicacao = await prisma.publicacao.findUnique({
    where: { id },
    select: { id: true, imagemCapa: true },
  })
  if (!publicacao) return responderErro(event, ['Publicação não encontrada.'], '/publicacoes')

  if (campo('acao') === 'remover') {
    await prisma.publicacao.update({ where: { id }, data: { imagemCapa: null } })
    await apagarCapa(publicacao.imagemCapa)
    return responderSucesso(event, voltar)
  }

  const enviado = partes.find(p => p.name === 'imagem' && p.filename)
  const bytes = enviado?.data ?? Buffer.alloc(0)

  // O tipo declarado pelo navegador é ignorado: quem decide são os bytes.
  const problemas = problemasDaImagem(bytes)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const nome = await guardarCapa(bytes, tipoDaImagem(bytes)!)
  await prisma.publicacao.update({ where: { id }, data: { imagemCapa: nome } })

  // A antiga só cai depois que a nova está gravada e apontada: se algo falhar
  // no meio, a publicação continua com a capa que tinha.
  await apagarCapa(publicacao.imagemCapa)

  return responderSucesso(event, voltar)
})
