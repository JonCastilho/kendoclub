import { describe, expect, it } from 'vitest'
import { formatarReais, interpretarValor } from '../shared/dinheiro'

// O pt-BR separa o símbolo da moeda do valor com espaço não separável, e não
// com espaço comum. Comparar por expressão regular com \s cobre os dois sem
// precisar do caractere invisível dentro do teste.
const reais = (valor: string) => new RegExp(`^R\\$\\s${valor.replace('.', '\\.')}$`)

describe('formatarReais', () => {
  it('formata número', () => {
    expect(formatarReais(120.5)).toMatch(reais('120,50'))
  })

  it('formata o texto que o Prisma devolve para Decimal', () => {
    expect(formatarReais('120.5')).toMatch(reais('120,50'))
  })

  it('trata ausência de valor como zero', () => {
    expect(formatarReais(null)).toMatch(reais('0,00'))
    expect(formatarReais(undefined)).toMatch(reais('0,00'))
  })

  it('não quebra com texto inválido', () => {
    expect(formatarReais('abc')).toMatch(reais('0,00'))
  })

  it('separa o milhar', () => {
    expect(formatarReais(1234.56)).toMatch(reais('1.234,56'))
  })
})

describe('interpretarValor', () => {
  it('aceita o formato brasileiro', () => {
    expect(interpretarValor('120,50')).toBe(120.5)
    expect(interpretarValor('1.234,56')).toBe(1234.56)
  })

  it('aceita o formato americano', () => {
    expect(interpretarValor('120.50')).toBe(120.5)
  })

  it('aceita número inteiro', () => {
    expect(interpretarValor('120')).toBe(120)
  })

  it('ignora espaços e o símbolo de moeda', () => {
    expect(interpretarValor(' R$ 120,50 ')).toBe(120.5)
  })

  it('aceita zero', () => {
    expect(interpretarValor('0')).toBe(0)
  })

  it('recusa o que não dá para entender', () => {
    expect(interpretarValor('')).toBeNull()
    expect(interpretarValor('abc')).toBeNull()
    expect(interpretarValor('12,34,56')).toBeNull()
    expect(interpretarValor('-50')).toBeNull()
  })
})
