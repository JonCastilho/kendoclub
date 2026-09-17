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
 * Título (shogo). Fica fora da escala: tem data própria, e a carência do Kyoshi
 * conta a partir do Renshi, não do dan.
 */
export type Shogo = 'RENSHI' | 'KYOSHI'

export const ROTULO_DO_SHOGO: Record<Shogo, string> = { RENSHI: 'Renshi', KYOSHI: 'Kyoshi' }

/** O título mais alto: quem tem Kyoshi também guarda a linha do Renshi. */
export function shogoMaisAlto(shogos: Shogo[]): Shogo | null {
  if (shogos.includes('KYOSHI')) return 'KYOSHI'
  return shogos.includes('RENSHI') ? 'RENSHI' : null
}

/** "6º dan Renshi", ou só a graduação para quem não tem título. */
export function rotuloComShogo(grau: Grau | null | undefined, shogos: Shogo[]): string {
  const shogo = shogoMaisAlto(shogos)
  return shogo ? `${rotuloDaGraduacao(grau)} ${ROTULO_DO_SHOGO[shogo]}` : rotuloDaGraduacao(grau)
}

/**
 * Ordem numérica: kyu é negativo e dan é positivo, então comparar dois graus é
 * comparar dois números — 6º kyu (-6) < 1º kyu (-1) < 1º dan (1).
 *
 * A ordem vem daqui, e nunca do enum no banco: 10º e 9º kyu foram acrescentados
 * depois e estão no fim da lista do Postgres.
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

/**
 * Rótulo da graduação, incluindo o caso de quem ainda não tem grau.
 *
 * Mukyu (無級) é literalmente "sem grau" — por isso é representado pela ausência
 * de valor, e não por um item do enum que significaria "nenhum".
 */
export function rotuloDaGraduacao(grau: Grau | null | undefined): string {
  return grau ? rotuloDoGrau(grau) : 'mukyu'
}
