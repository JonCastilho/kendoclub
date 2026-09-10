/**
 * O que o sistema aceita como imagem de capa.
 *
 * A checagem é feita nos primeiros bytes do arquivo — nunca na extensão do nome
 * nem no `content-type` que o navegador declara. Os dois são escritos por quem
 * envia: renomear `script.html` para `foto.jpg` custa um clique.
 */

/** Três megabytes. Foto de celular cabe; a coleção de fotos do treino, não. */
export const LIMITE_BYTES = 3 * 1024 * 1024

export type TipoImagem = 'image/jpeg' | 'image/png' | 'image/webp'

const EXTENSOES: Record<TipoImagem, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensaoDoTipo(tipo: TipoImagem): string {
  return EXTENSOES[tipo]
}

function assinaturaBate(bytes: Uint8Array, assinatura: number[], deslocamento = 0): boolean {
  return assinatura.every((byte, i) => bytes[deslocamento + i] === byte)
}

/**
 * Descobre o tipo pela assinatura do arquivo.
 *
 * A lista é curta de propósito: o que não está nela é recusado. SVG fica de
 * fora por ser o caso mais perigoso — é texto, aceita `<script>` dentro e o
 * navegador executa ao abrir.
 */
export function tipoDaImagem(bytes: Uint8Array): TipoImagem | null {
  if (assinaturaBate(bytes, [0xFF, 0xD8, 0xFF])) return 'image/jpeg'
  if (assinaturaBate(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'image/png'

  // WebP é um contêiner RIFF: "RIFF", quatro bytes de tamanho, e então "WEBP".
  if (assinaturaBate(bytes, [0x52, 0x49, 0x46, 0x46])
    && assinaturaBate(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }

  return null
}

/** Lista de problemas. Vazia significa que o arquivo pode ser guardado. */
export function problemasDaImagem(bytes: Uint8Array): string[] {
  if (bytes.length === 0) return ['Escolha um arquivo de imagem.']

  if (bytes.length > LIMITE_BYTES) {
    const megabytes = (LIMITE_BYTES / 1024 / 1024).toFixed(0)
    return [`A imagem precisa ter no máximo ${megabytes} MB.`]
  }

  if (!tipoDaImagem(bytes)) return ['A imagem precisa ser JPEG, PNG ou WebP.']

  return []
}

/**
 * O nome que guardamos em disco: 32 caracteres sorteados mais a extensão.
 *
 * Conferir o formato antes de tocar no disco é redundante — o nome é gerado
 * aqui dentro e nunca vem de quem envia —, mas é a redundância que garante que
 * nenhum `../` chegue ao sistema de arquivos, mesmo que um dia o valor passe a
 * vir de outro lugar.
 */
export function nomeDeCapaValido(nome: string): boolean {
  return /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(nome)
}

/**
 * Endereço público da capa.
 *
 * O nome do arquivo entra no endereço para que trocar a capa troque o endereço:
 * o navegador não tem como mostrar a imagem antiga em cache.
 */
export function urlDaCapa(slug: string, arquivo: string | null | undefined): string | null {
  return arquivo ? `/api/publicacoes/${slug}/capa/${arquivo}` : null
}
