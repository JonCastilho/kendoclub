/**
 * Leitura de campos vindos de formulário HTML, onde tudo chega como texto.
 */

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

export function opcional(valor: unknown): string | null {
  const t = texto(valor)
  return t === '' ? null : t
}

/**
 * Data de `<input type="date">`, que chega como AAAA-MM-DD.
 *
 * Interpretada como meia-noite UTC de propósito: no horário de Brasília,
 * `new Date('2015-04-02')` seguido de exibição local mostraria 1º de abril. Data
 * de nascimento e de filiação são dias do calendário, não instantes.
 */
export function dataUtc(valor: unknown): Date | null {
  const t = texto(valor)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null

  const data = new Date(`${t}T00:00:00.000Z`)
  return Number.isNaN(data.getTime()) ? null : data
}

/** Caixa de seleção marcada chega como "on"; desmarcada não chega. */
export function marcado(valor: unknown): boolean {
  return valor === 'on' || valor === 'true' || valor === '1'
}

/**
 * Data de consentimento: marca com o instante do aceite, e preserva a data
 * original se já havia sido dado — reaceitar não deve reescrever quando foi.
 */
export function consentimentoEm(valor: unknown, anterior: Date | null | undefined): Date | null {
  if (!marcado(valor)) return null
  return anterior ?? new Date()
}
