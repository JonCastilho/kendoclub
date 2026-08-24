import { describe, expect, it } from 'vitest'
import {
  competenciaAtual,
  ehCompetenciaValida,
  formatarCompetencia,
  proximaCompetencia,
  vencimentoDa,
} from '../shared/competencia'

describe('ehCompetenciaValida', () => {
  it('aceita AAAA-MM', () => {
    expect(ehCompetenciaValida('2026-08')).toBe(true)
    expect(ehCompetenciaValida('2026-01')).toBe(true)
    expect(ehCompetenciaValida('2026-12')).toBe(true)
  })

  it('recusa mês fora da faixa e formatos errados', () => {
    expect(ehCompetenciaValida('2026-00')).toBe(false)
    expect(ehCompetenciaValida('2026-13')).toBe(false)
    expect(ehCompetenciaValida('2026-8')).toBe(false)
    expect(ehCompetenciaValida('08-2026')).toBe(false)
    expect(ehCompetenciaValida('')).toBe(false)
  })
})

describe('competenciaAtual', () => {
  it('usa o mês da data informada', () => {
    expect(competenciaAtual(new Date(2026, 7, 24))).toBe('2026-08')
  })

  it('preenche o zero à esquerda', () => {
    expect(competenciaAtual(new Date(2026, 0, 1))).toBe('2026-01')
  })
})

describe('formatarCompetencia', () => {
  it('escreve o mês por extenso', () => {
    expect(formatarCompetencia('2026-08')).toBe('agosto/2026')
    expect(formatarCompetencia('2026-03')).toBe('março/2026')
  })

  it('reclama de competência inválida', () => {
    expect(() => formatarCompetencia('2026-13')).toThrow()
  })
})

describe('proximaCompetencia', () => {
  it('avança um mês', () => {
    expect(proximaCompetencia('2026-08')).toBe('2026-09')
  })

  it('vira o ano em dezembro', () => {
    expect(proximaCompetencia('2026-12')).toBe('2027-01')
  })
})

describe('vencimentoDa', () => {
  it('monta a data no dia pedido', () => {
    expect(vencimentoDa('2026-08', 10).toISOString()).toBe('2026-08-10T00:00:00.000Z')
  })

  it('encurta para o último dia quando o mês não tem o dia pedido', () => {
    expect(vencimentoDa('2026-02', 31).toISOString()).toBe('2026-02-28T00:00:00.000Z')
  })

  it('reconhece ano bissexto', () => {
    expect(vencimentoDa('2028-02', 30).toISOString()).toBe('2028-02-29T00:00:00.000Z')
  })

  it('recusa dia fora da faixa', () => {
    expect(() => vencimentoDa('2026-08', 0)).toThrow()
    expect(() => vencimentoDa('2026-08', 32)).toThrow()
  })
})
