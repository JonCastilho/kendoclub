/**
 * Regras do newsfeed.
 *
 * Aqui mora a decisão mais delicada do sistema até agora: o que um visitante
 * anônimo pode ver. Errar aqui não é inconveniente — é publicar na internet um
 * post que o clube marcou como restrito.
 */

export type Visibilidade = 'PUBLICA' | 'RESTRITA'

export interface Publicacao {
  visibilidade: Visibilidade
  publicadaEm?: Date | string | null
}

/** Rascunho é o que ainda não foi publicado; só a diretoria enxerga. */
export function estaPublicada(publicacao: Publicacao): boolean {
  return Boolean(publicacao.publicadaEm)
}

export interface Leitor {
  logado: boolean
  ehDiretoria: boolean
}

export const VISITANTE: Leitor = { logado: false, ehDiretoria: false }

/**
 * Quem pode ler cada publicação.
 *
 * A ordem das checagens importa: a diretoria vê tudo, inclusive rascunho;
 * ninguém mais vê rascunho; e só quem está autenticado vê publicação restrita.
 */
export function podeVer(publicacao: Publicacao, leitor: Leitor): boolean {
  if (leitor.ehDiretoria) return true
  if (!estaPublicada(publicacao)) return false
  if (publicacao.visibilidade === 'RESTRITA') return leitor.logado
  return true
}

/**
 * Endereço estável de uma publicação, derivado do título.
 *
 * Acentos viram letra simples e o resto vira hífen, para o endereço não
 * depender de codificação — "Exame de graduação em março" fica
 * "exame-de-graduacao-em-marco".
 */
export function gerarSlug(titulo: string): string {
  return titulo
    .normalize('NFD')
    // Marcas de acento, escritas como escape: literais, seriam caracteres
    // invisíveis no meio da expressão.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

/**
 * O que o endpoint de detalhe devolve.
 *
 * Escrito à mão porque a inferência do `useFetch` não alcança
 * `/api/publicacoes/[slug]`: o caminho dinâmico convive com a rota estática
 * `/api/publicacoes/publicar`, e o tipo sai vazio.
 */
export interface PublicacaoDetalhada {
  id: string
  titulo: string
  slug: string
  conteudo: string
  html: string
  imagemCapa: string | null
  visibilidade: Visibilidade
  publicadaEm: string | null
  podeEditar: boolean
}

/** Lista de problemas. Vazia significa que a publicação pode ser salva. */
export function problemasDaPublicacao(dados: {
  titulo: string
  conteudo: string
}): string[] {
  const problemas: string[] = []

  if (!dados.titulo.trim()) problemas.push('Informe o título.')
  else if (!gerarSlug(dados.titulo)) {
    // "!!!" vira slug vazio, e sem slug a publicação não teria endereço.
    problemas.push('O título precisa ter letras ou números.')
  }

  if (!dados.conteudo.trim()) problemas.push('Escreva o conteúdo da publicação.')

  return problemas
}
