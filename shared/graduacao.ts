import type { Grau } from '@prisma/client'

/**
 * Faixa de graduação.
 *
 * O enum do banco guarda a faixa máxima possível (10º kyu a 8º dan) e cada
 * modalidade decide onde a lista começa, por `Modalidade.kyuInicial`. Kendo
 * costuma começar no 6º kyu; iaido, no 5º.
 *
 * O import de tipo do Prisma é apagado na compilação, então nada do cliente
 * Prisma vai parar no pacote que o navegador baixa.
 */

export const KYU_MAXIMO = 10
export const DAN_MAXIMO = 8

/**
 * Ordem numérica: kyu é negativo e dan é positivo, então comparar dois graus é
 * comparar dois números — 6º kyu (-6) < 1º kyu (-1) < 1º dan (1).
 */
export function ordemDoGrau(grau: Grau): number {
  const [tipo, numero] = grau.split('_') as ['KYU' | 'DAN', string]
  return tipo === 'KYU' ? -Number(numero) : Number(numero)
}

export function rotuloDoGrau(grau: Grau): string {
  const [tipo, numero] = grau.split('_') as ['KYU' | 'DAN', string]
  return `${numero}º ${tipo.toLowerCase()}`
}

/** Graus válidos de uma modalidade, do mais baixo ao mais alto. */
export function grausDaModalidade(kyuInicial: number): Grau[] {
  const inicio = Math.min(Math.max(Math.trunc(kyuInicial), 1), KYU_MAXIMO)

  const kyus: Grau[] = []
  for (let n = inicio; n >= 1; n--) kyus.push(`KYU_${n}` as Grau)

  const dans: Grau[] = []
  for (let n = 1; n <= DAN_MAXIMO; n++) dans.push(`DAN_${n}` as Grau)

  return [...kyus, ...dans]
}

export function grauPertenceAModalidade(grau: Grau, kyuInicial: number): boolean {
  return grausDaModalidade(kyuInicial).includes(grau)
}

interface GraduacaoComparavel {
  grau: Grau
  obtidaEm: Date
}

/**
 * Graduação atual: a mais recente por data.
 *
 * Empate na data desempata pelo grau mais alto — acontece quando alguém
 * cadastra o histórico inteiro de uma vez, com todas as datas iguais.
 */
export function graduacaoAtual<T extends GraduacaoComparavel>(graduacoes: T[]): T | null {
  if (graduacoes.length === 0) return null

  return graduacoes.reduce((atual, candidata) => {
    const diferencaDeData = candidata.obtidaEm.getTime() - atual.obtidaEm.getTime()
    if (diferencaDeData > 0) return candidata
    if (diferencaDeData < 0) return atual
    return ordemDoGrau(candidata.grau) > ordemDoGrau(atual.grau) ? candidata : atual
  })
}
