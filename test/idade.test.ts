import { describe, expect, it } from 'vitest'
import { calcularIdade, ehMenorDeIdade } from '../shared/idade'

const d = (iso: string) => new Date(iso)

describe('calcularIdade', () => {
  it('conta os anos completos', () => {
    expect(calcularIdade(d('2000-06-15'), d('2026-08-24'))).toBe(26)
  })

  it('não conta o ano de quem ainda não fez aniversário', () => {
    expect(calcularIdade(d('2000-12-15'), d('2026-08-24'))).toBe(25)
  })

  it('conta no próprio dia do aniversário', () => {
    expect(calcularIdade(d('2000-08-24'), d('2026-08-24'))).toBe(26)
  })

  it('não conta na véspera do aniversário', () => {
    expect(calcularIdade(d('2000-08-25'), d('2026-08-24'))).toBe(25)
  })

  it('lida com nascido em 29 de fevereiro', () => {
    expect(calcularIdade(d('2008-02-29'), d('2026-02-28'))).toBe(17)
    expect(calcularIdade(d('2008-02-29'), d('2026-03-01'))).toBe(18)
  })
})

describe('ehMenorDeIdade', () => {
  it('menor até a véspera dos 18', () => {
    expect(ehMenorDeIdade(d('2008-08-25'), d('2026-08-24'))).toBe(true)
  })

  it('maior no dia em que faz 18', () => {
    // Importa porque é a partir daqui que o cadastro deixa de exigir responsável.
    expect(ehMenorDeIdade(d('2008-08-24'), d('2026-08-24'))).toBe(false)
  })

  it('criança é menor', () => {
    expect(ehMenorDeIdade(d('2018-01-01'), d('2026-08-24'))).toBe(true)
  })
})
