/**
 * Dinheiro entra pelo teclado de gente e sai pela tela de gente.
 *
 * O Prisma devolve Decimal como texto no JSON, então tudo aqui aceita texto ou
 * número — converter cedo para float e carregar isso pelo sistema é como somas
 * de centavos começam a errar.
 */

export function formatarReais(valor: string | number | null | undefined): string {
  const numero = typeof valor === 'string' ? Number(valor) : (valor ?? 0)
  if (!Number.isFinite(numero)) return 'R$ 0,00'

  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Lê valor digitado, aceitando o formato brasileiro e o americano.
 *
 * "120,50" e "120.50" são a mesma coisa para quem digita; "1.234,56" também
 * aparece. Devolve null quando não dá para entender — melhor recusar do que
 * gravar um número que ninguém quis.
 */
export function interpretarValor(entrada: string): number | null {
  const limpo = entrada.replace(/\s|R\$/g, '').trim()
  if (!limpo) return null

  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')

  let normalizado = limpo

  if (temVirgula && temPonto) {
    // "1.234,56": ponto é separador de milhar, vírgula é decimal.
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  }
  else if (temVirgula) {
    normalizado = limpo.replace(',', '.')
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null

  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}
