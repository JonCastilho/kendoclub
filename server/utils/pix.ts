import QRCode from 'qrcode'
import {
  type DadosDoPix,
  gerarPix,
  limiteDaMensagem,
  montarMensagemDoPix,
  problemasDoPix,
} from '~~/shared/pix'

/** Chave, titular e cidade do Pix do clube, como estão em Configurações. */
export async function configuracaoDoPix(): Promise<Pick<DadosDoPix, 'chave' | 'nome' | 'cidade'>> {
  const clube = await usePrisma().configuracaoClube.findUnique({
    where: { id: 1 },
    select: { chavePix: true, titularPix: true, cidadePix: true },
  })
  return { chave: clube?.chavePix ?? '', nome: clube?.titularPix ?? '', cidade: clube?.cidadePix ?? '' }
}

/** Problemas da configuração, para dizer à diretoria o que preencher. */
export async function problemasDaConfiguracaoDoPix(): Promise<string[]> {
  return problemasDoPix({ ...(await configuracaoDoPix()), valor: 1 })
}

export interface PixGerado {
  copiaECola: string
  /** Imagem PNG em data URL, pronta para o `src` de um `<img>`. */
  qrCode: string
  mensagem: string
}

/**
 * O Pix de uma cobrança de evento: o código "copia e cola", o QR code dele e a
 * mensagem, que diz quem paga e o que paga. Nulo se o clube não configurou o
 * Pix.
 */
export async function pixDaCobranca(
  cobranca: { valor: number, itens: string[] },
  pagador: string,
  evento: string,
): Promise<PixGerado | null> {
  const clube = await configuracaoDoPix()
  if (problemasDoPix({ ...clube, valor: cobranca.valor }).length > 0) return null

  const mensagem = montarMensagemDoPix(
    { nome: pagador, evento, itens: cobranca.itens },
    limiteDaMensagem(clube.chave),
  )
  const copiaECola = gerarPix({ ...clube, valor: cobranca.valor, mensagem })
  const qrCode = await QRCode.toDataURL(copiaECola, { errorCorrectionLevel: 'M', margin: 2, width: 320 })

  return { copiaECola, qrCode, mensagem }
}
