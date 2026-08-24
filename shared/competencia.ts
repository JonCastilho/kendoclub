/**
 * Competência é o mês de referência de uma mensalidade, no formato AAAA-MM.
 * É texto, e não data, porque identifica um mês inteiro — tratar como data traz
 * junto o problema de fuso horário para nada.
 */

const FORMATO = /^\d{4}-(0[1-9]|1[0-2])$/

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

export function ehCompetenciaValida(competencia: string): boolean {
  return FORMATO.test(competencia)
}

/** Competência do mês corrente, no fuso local. */
export function competenciaAtual(data: Date = new Date()): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${data.getFullYear()}-${mes}`
}

/** '2026-08' → 'agosto/2026' */
export function formatarCompetencia(competencia: string): string {
  if (!ehCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`)
  }
  const [ano, mes] = competencia.split('-')
  return `${MESES[Number(mes) - 1]}/${ano}`
}

/** '2026-12' → '2027-01' */
export function proximaCompetencia(competencia: string): string {
  if (!ehCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`)
  }
  const [ano, mes] = competencia.split('-').map(Number)
  return mes === 12
    ? `${ano + 1}-01`
    : `${ano}-${String(mes + 1).padStart(2, '0')}`
}

/**
 * Vencimento da competência num dia do mês. Dia que não existe no mês cai no
 * último dia dele — dia 31 em fevereiro vira 28 ou 29, não 3 de março.
 */
export function vencimentoDa(competencia: string, diaVencimento: number): Date {
  if (!ehCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`)
  }
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    throw new Error(`Dia de vencimento inválido: ${diaVencimento}`)
  }
  const [ano, mes] = competencia.split('-').map(Number)
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return new Date(Date.UTC(ano, mes - 1, Math.min(diaVencimento, ultimoDia)))
}
