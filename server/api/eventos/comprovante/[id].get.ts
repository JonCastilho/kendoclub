import { tipoDaImagem } from '~~/shared/imagem'

/**
 * Entrega o comprovante, a quem o enviou e à diretoria.
 *
 * O arquivo não fica em pasta pública: comprovante de Pix mostra nome, banco e
 * às vezes saldo, e só existe enquanto aguarda a análise. Quem não pode ver e
 * comprovante que não existe recebem a mesma resposta, para o endereço não
 * servir de sonda.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  const id = getRouterParam(event, 'id')!

  const cobranca = await usePrisma().cobrancaEvento.findUnique({
    where: { id },
    select: { comprovante: true, inscricaoEvento: { select: { praticanteId: true } } },
  })

  const dono = Boolean(usuario.praticanteId) && cobranca?.inscricaoEvento.praticanteId === usuario.praticanteId
  if (!cobranca?.comprovante || !(usuario.papel === 'DIRETORIA' || dono)) {
    throw createError({ statusCode: 404, statusMessage: 'Comprovante não encontrado.' })
  }

  const bytes = await lerComprovante(cobranca.comprovante)
  const tipo = bytes && tipoDaImagem(bytes)
  if (!bytes || !tipo) {
    throw createError({ statusCode: 404, statusMessage: 'Comprovante não encontrado.' })
  }

  setResponseHeaders(event, {
    // O tipo sai da assinatura do arquivo, não do que foi declarado no envio.
    'content-type': tipo,
    'x-content-type-options': 'nosniff',
    'content-disposition': 'inline',
    // Dado financeiro de uma pessoa: nada de cache, nem o do navegador.
    'cache-control': 'private, no-store',
  })

  return bytes
})
