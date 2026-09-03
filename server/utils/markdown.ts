import MarkdownIt from 'markdown-it'

/**
 * Converte o markdown das publicações em HTML.
 *
 * `html: false` é a decisão de segurança: HTML escrito dentro do texto é
 * escapado, não interpretado. Sem isso, qualquer `<script>` no corpo de um post
 * viraria script de verdade na página pública do clube — e bastaria uma conta
 * de diretoria comprometida para transformar o site numa armadilha.
 */
const renderizador = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

export function markdownParaHtml(texto: string): string {
  return renderizador.render(texto ?? '')
}

/** Primeiras linhas em texto puro, para a chamada do feed. */
export function resumoDoTexto(texto: string, limite = 200): string {
  const limpo = (texto ?? '')
    .replace(/[#*_>`~[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return limpo.length <= limite ? limpo : `${limpo.slice(0, limite).trimEnd()}…`
}
