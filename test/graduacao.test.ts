import { describe, expect, it } from 'vitest'
import {
  graduacaoAtual,
  grauPertenceAModalidade,
  grausDaModalidade,
  ordemDoGrau,
  rotuloDoGrau,
} from '../shared/graduacao'

describe('ordemDoGrau', () => {
  it('põe kyu abaixo de dan', () => {
    expect(ordemDoGrau('KYU_1')).toBeLessThan(ordemDoGrau('DAN_1'))
  })

  it('inverte a contagem dos kyu', () => {
    // 6º kyu é mais baixo que 1º kyu, ao contrário do que o número sugere.
    expect(ordemDoGrau('KYU_6')).toBeLessThan(ordemDoGrau('KYU_1'))
  })

  it('mantém a contagem dos dan', () => {
    expect(ordemDoGrau('DAN_1')).toBeLessThan(ordemDoGrau('DAN_8'))
  })
})

describe('rotuloDoGrau', () => {
  it('escreve como se fala', () => {
    expect(rotuloDoGrau('KYU_6')).toBe('6º kyu')
    expect(rotuloDoGrau('DAN_3')).toBe('3º dan')
  })
})

describe('grausDaModalidade', () => {
  it('começa no kyu configurado da modalidade', () => {
    expect(grausDaModalidade(6)[0]).toBe('KYU_6')
    expect(grausDaModalidade(5)[0]).toBe('KYU_5')
  })

  it('vai do mais baixo ao mais alto', () => {
    const graus = grausDaModalidade(6)
    expect(graus.at(0)).toBe('KYU_6')
    expect(graus.at(-1)).toBe('DAN_8')
    expect(graus).toHaveLength(6 + 8)
  })

  it('sempre inclui os oito dan', () => {
    expect(grausDaModalidade(1).filter(g => g.startsWith('DAN'))).toHaveLength(8)
  })

  it('não sai da faixa mesmo com configuração absurda', () => {
    expect(grausDaModalidade(99)[0]).toBe('KYU_10')
    expect(grausDaModalidade(0)[0]).toBe('KYU_1')
    expect(grausDaModalidade(-3)[0]).toBe('KYU_1')
  })
})

describe('grauPertenceAModalidade', () => {
  it('recusa kyu acima do início da modalidade', () => {
    // Modalidade que começa no 5º kyu não tem 6º kyu.
    expect(grauPertenceAModalidade('KYU_6', 5)).toBe(false)
    expect(grauPertenceAModalidade('KYU_5', 5)).toBe(true)
  })

  it('aceita qualquer dan', () => {
    expect(grauPertenceAModalidade('DAN_8', 5)).toBe(true)
  })
})

describe('graduacaoAtual', () => {
  it('devolve nada quando não há graduação', () => {
    expect(graduacaoAtual([])).toBeNull()
  })

  it('escolhe a mais recente', () => {
    const historico = [
      { grau: 'KYU_6' as const, obtidaEm: new Date('2020-03-01') },
      { grau: 'KYU_3' as const, obtidaEm: new Date('2023-06-01') },
      { grau: 'KYU_5' as const, obtidaEm: new Date('2021-08-01') },
    ]
    expect(graduacaoAtual(historico)?.grau).toBe('KYU_3')
  })

  it('desempata pelo grau mais alto quando as datas são iguais', () => {
    // Acontece quando alguém cadastra o histórico inteiro de uma vez.
    const mesmaData = new Date('2024-01-15')
    const historico = [
      { grau: 'KYU_2' as const, obtidaEm: mesmaData },
      { grau: 'DAN_1' as const, obtidaEm: mesmaData },
      { grau: 'KYU_1' as const, obtidaEm: mesmaData },
    ]
    expect(graduacaoAtual(historico)?.grau).toBe('DAN_1')
  })

  it('não se deixa enganar por ordem de entrada', () => {
    const historico = [
      { grau: 'DAN_2' as const, obtidaEm: new Date('2025-05-01') },
      { grau: 'DAN_1' as const, obtidaEm: new Date('2022-05-01') },
    ]
    expect(graduacaoAtual(historico)?.grau).toBe('DAN_2')
  })
})
