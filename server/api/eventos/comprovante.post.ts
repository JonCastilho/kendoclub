import { LIMITE_DO_COMPROVANTE, problemasDaImagem, tipoDaImagem } from '~~/shared/imagem'

/**
 * A pessoa declara que pagou e anexa o comprovante do Pix.
 *
 * Só quem pagou declara: nem a diretoria avisa por outra pessoa — ela dá a
 * baixa. O comprovante é obrigatório e só vale para um Pix que ainda bate com a
 * inscrição. Declarar trava a inscrição para quem a fez: a diretoria confere
 * o que foi pago contra o que foi escolhido.
 *
 * Multipart, como a capa das publicações, e pelo mesmo motivo: é a rota que
 * recebe arquivo. O arquivo só fica em disco até a análise.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)

  // Recusa pelo cabeçalho antes de ler o corpo: sem isto, um envio enorme seria
  // carregado inteiro na memória só para ser rejeitado.
  const declarado = Number(getHeader(event, 'content-length') ?? 0)
  if (declarado > LIMITE_DO_COMPROVANTE + 64 * 1024) {
    return responderErro(event, problemasDaImagem(new Uint8Array(LIMITE_DO_COMPROVANTE + 1), LIMITE_DO_COMPROVANTE), '/agenda')
  }

  const partes = (await readMultipartFormData(event)) ?? []
  const eventoId = partes.find(p => p.name === 'eventoId' && !p.filename)?.data.toString('utf8').trim() ?? ''

  const conferida = usuario.praticanteId ? await cobrancaConferida(eventoId, usuario.praticanteId) : null
  const voltar = conferida ? `/agenda/${conferida.evento.slug}#pix` : '/agenda'

  if (!usuario.praticanteId) return responderErro(event, ['Sua conta não está ligada a um praticante.'], voltar)
  if (!conferida?.cobranca) return responderErro(event, ['Gere o Pix antes de enviar o comprovante.'], voltar)

  if (conferida.situacao === 'PAGA') return responderErro(event, ['Este pagamento já foi confirmado.'], voltar)
  if (conferida.situacao === 'EM_ANALISE') {
    return responderErro(event, ['O comprovante já foi enviado e aguarda a conferência da diretoria.'], voltar)
  }
  if (!conferida.atualizada) {
    return responderErro(event, ['A inscrição mudou depois do Pix. Gere um novo antes de enviar o comprovante.'], voltar)
  }

  const enviado = partes.find(p => p.name === 'comprovante' && p.filename)
  const bytes = enviado?.data ?? Buffer.alloc(0)

  // O tipo declarado pelo navegador é ignorado: quem decide são os bytes.
  const problemas = problemasDaImagem(bytes, LIMITE_DO_COMPROVANTE)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const nome = await guardarComprovante(bytes, tipoDaImagem(bytes)!)

  try {
    await usePrisma().cobrancaEvento.update({
      where: { id: conferida.cobranca.id },
      data: {
        declaradaEm: new Date(),
        comprovante: nome,
        // Nova declaração recomeça a análise: o que a diretoria decidiu antes
        // vale para o comprovante de antes.
        analisadaEm: null,
        aceita: null,
        motivoRecusa: null,
      },
    })
  }
  catch (erro) {
    await apagarComprovante(nome)
    throw erro
  }

  return responderSucesso(event, voltar)
})
