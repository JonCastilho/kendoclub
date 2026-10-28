import { describe, expect, it } from 'vitest'
import { cobrancaAtualizada, itensDaInscricao } from '../shared/cobrancaEvento'

const kendo = { id: 'm1', nome: 'Kendo', kyuInicial: 6 }
const iaido = { id: 'm2', nome: 'Iaido', kyuInicial: 5 }

const seminario = { id: 's1', tipo: 'SEMINARIO' as const, modalidade: kendo }
const exame = { id: 'e1', tipo: 'EXAME' as const, modalidade: kendo }
const competicao = { id: 'c1', tipo: 'COMPETICAO' as const, modalidade: kendo }

const nada = { subeventoIds: [] as string[], alojamento: false, obentos: {} as Record<string, number> }

describe('itensDaInscricao', () => {
  it('lista o que a pessoa escolheu, na ordem dos subeventos', () => {
    const itens = itensDaInscricao({ ...nada, subeventoIds: ['c1', 's1'] }, [seminario, exame, competicao])
    expect(itens).toEqual(['seminário', 'competição'])
  })

  it('soma os obentos de todos os dias e inclui o alojamento', () => {
    const itens = itensDaInscricao(
      { subeventoIds: ['s1'], alojamento: true, obentos: { '2026-11-10': 2, '2026-11-11': 1 } },
      [seminario],
    )
    expect(itens).toEqual(['seminário', 'alojamento', 'obento (3)'])
  })

  it('quem só encomendou obento paga só o obento', () => {
    expect(itensDaInscricao({ ...nada, obentos: { '2026-11-10': 1 } }, [seminario])).toEqual(['obento (1)'])
  })

  it('não conta dia com zero obentos', () => {
    expect(itensDaInscricao({ ...nada, obentos: { '2026-11-10': 0 } }, [seminario])).toEqual([])
  })

  it('com mais de um subevento do mesmo tipo, diz a modalidade', () => {
    const outra = { id: 'c2', tipo: 'COMPETICAO' as const, modalidade: iaido }
    const itens = itensDaInscricao({ ...nada, subeventoIds: ['c1', 'c2', 's1'] }, [seminario, competicao, outra])
    expect(itens).toEqual(['seminário', 'competição (Kendo)', 'competição (Iaido)'])
  })
})

describe('cobrancaAtualizada', () => {
  const gerada = { valor: 70, itens: ['seminário', 'obento (2)'] }

  it('vale enquanto o total e os itens são os mesmos', () => {
    expect(cobrancaAtualizada(gerada, { total: 70, itens: ['seminário', 'obento (2)'] })).toBe(true)
  })

  it('não vale se o total mudou, mesmo com os mesmos itens', () => {
    expect(cobrancaAtualizada(gerada, { total: 75, itens: ['seminário', 'obento (2)'] })).toBe(false)
  })

  it('não vale se os itens mudaram, mesmo com o mesmo total', () => {
    expect(cobrancaAtualizada(gerada, { total: 70, itens: ['seminário', 'obento (3)'] })).toBe(false)
    expect(cobrancaAtualizada(gerada, { total: 70, itens: ['seminário'] })).toBe(false)
  })

  it('compara em centavos, sem o erro de ponto flutuante', () => {
    expect(cobrancaAtualizada({ valor: 0.3, itens: [] }, { total: 0.1 + 0.2, itens: [] })).toBe(true)
  })
})
