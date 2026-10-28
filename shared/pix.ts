/**
 * Pix "copia e cola": o texto que vira QR code (padrão BR Code, do Banco
 * Central). É um Pix estático — a chave do clube, o valor e uma mensagem —,
 * então não depende de integração com banco: quem paga escaneia ou cola, e a
 * diretoria confere pelo extrato e pelo comprovante.
 */

/** Tamanho máximo do conteúdo do campo 26, que guarda a chave e a mensagem. */
const LIMITE_DO_CAMPO_26 = 99
const GUI = 'br.gov.bcb.pix'

/** CRC16/CCITT-FALSE, o que o BR Code usa: polinômio 0x1021, partindo de 0xFFFF. */
export function crc16(texto: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Texto aceito no QR: só ASCII imprimível. Tira acento, troca travessão por
 * hífen e descarta o que não tem equivalente — banco que recebe caractere
 * fora do padrão recusa o código inteiro.
 */
export function textoAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identificador + tamanho em dois dígitos + valor. */
function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`
}

/**
 * Quantos caracteres cabem na mensagem. O campo 26 divide 99 caracteres entre o
 * identificador do Pix, a chave e a mensagem; chave longa (aleatória) deixa
 * pouco espaço.
 */
export function limiteDaMensagem(chave: string): number {
  const fixo = campo('00', GUI).length + campo('01', chave).length + 4
  return Math.max(0, LIMITE_DO_CAMPO_26 - fixo)
}

export interface DadosDoPix {
  chave: string
  /** Titular, como no banco; sai em maiúsculas e sem acento, até 25 caracteres. */
  nome: string
  /** Cidade do titular, até 15 caracteres. */
  cidade: string
  /** Em reais. */
  valor: number
  mensagem?: string
}

export function problemasDoPix(dados: DadosDoPix): string[] {
  const problemas: string[] = []
  if (!dados.chave.trim()) problemas.push('Informe a chave Pix do clube em Configurações.')
  if (!textoAscii(dados.nome)) problemas.push('Informe o titular do Pix em Configurações.')
  if (!textoAscii(dados.cidade)) problemas.push('Informe a cidade do clube em Configurações.')
  if (!(dados.valor > 0) || dados.valor > 9_999_999.99) problemas.push('O valor do Pix precisa ser maior que zero.')
  return problemas
}

/**
 * Monta o "copia e cola". Quem chama confere antes com `problemasDoPix`; aqui
 * o que passar do limite é cortado, porque o banco recusa o código em vez de
 * truncar.
 */
export function gerarPix(dados: DadosDoPix): string {
  const chave = dados.chave.trim()
  const mensagem = textoAscii(dados.mensagem ?? '').slice(0, limiteDaMensagem(chave))

  const conta = campo('00', GUI) + campo('01', chave) + (mensagem ? campo('02', mensagem) : '')

  const semCrc = [
    campo('00', '01'),
    // 11: pode ser pago mais de uma vez. O valor vai junto, então quem paga o
    // vê preenchido, mas o código não é de uso único.
    campo('01', '11'),
    campo('26', conta),
    campo('52', '0000'),
    campo('53', '986'),
    campo('54', dados.valor.toFixed(2)),
    campo('58', 'BR'),
    campo('59', textoAscii(dados.nome).toUpperCase().slice(0, 25)),
    campo('60', textoAscii(dados.cidade).toUpperCase().slice(0, 15)),
    // Sem identificador de transação: o clube confere pelo extrato.
    campo('62', campo('05', '***')),
    '6304',
  ].join('')

  return semCrc + crc16(semCrc)
}

/** Primeiro e último nome: "Jonas Thadeu Castilho" → "Jonas Castilho". */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(' ')
}

/**
 * Mensagem do Pix: quem paga e o que paga — "Jonas Castilho - Campeonato
 * Fukuhaku: competicao, exame, obento (2)". Cabe no limite do banco cedendo,
 * nesta ordem: os nomes do meio, parte do nome do evento, o evento inteiro e,
 * só por último, os itens. O que se identifica primeiro é quem paga.
 */
export function montarMensagemDoPix(
  dados: { nome: string, evento: string, itens: string[] },
  limite: number,
): string {
  const itens = dados.itens.length ? `: ${dados.itens.join(', ')}` : ''
  const monta = (nome: string, evento: string, comItens: string) =>
    textoAscii(evento ? `${nome} - ${evento}${comItens}` : `${nome}${comItens}`)

  const curto = nomeCurto(dados.nome)
  const evento = textoAscii(dados.evento)

  const inteiras = [monta(dados.nome, evento, itens), monta(curto, evento, itens)]
  const cabe = inteiras.find(c => c.length <= limite)
  if (cabe) return cabe

  // Evento comprido: ele fica com o que o nome e os itens não usam, se sobrar
  // espaço para algo legível.
  const espaco = limite - monta(curto, 'x', itens).length + 1
  if (espaco >= 8) return monta(curto, evento.slice(0, espaco).trim(), itens)

  const semEvento = monta(curto, '', itens)
  if (semEvento.length <= limite) return semEvento

  return monta(curto, evento, '').slice(0, limite).trim()
}
