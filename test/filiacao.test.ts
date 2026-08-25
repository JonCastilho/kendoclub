import { describe, expect, it } from 'vitest'
import {
  diasDeFiliacao,
  estaFiliado,
  filiacaoAberta,
  periodoConflita,
  periodoValido,
  primeiraFiliacaoEm,
} from '../shared/filiacao'

const d = (iso: string) => new Date(iso)

describe('estaFiliado', () => {
  it('quem tem período em aberto está filiado', () => {
    expect(estaFiliado([{ inicioEm: d('2020-03-01') }])).toBe(true)
  })

  it('quem só tem períodos fechados está desligado', () => {
    expect(estaFiliado([{ inicioEm: d('2020-03-01'), fimEm: d('2022-06-30') }])).toBe(false)
  })

  it('quem saiu e voltou está filiado', () => {
    const historico = [
      { inicioEm: d('2018-01-10'), fimEm: d('2020-02-01') },
      { inicioEm: d('2023-05-01') },
    ]
    expect(estaFiliado(historico)).toBe(true)
    expect(filiacaoAberta(historico)?.inicioEm).toEqual(d('2023-05-01'))
  })

  it('sem histórico, não está filiado', () => {
    expect(estaFiliado([])).toBe(false)
  })
})

describe('primeiraFiliacaoEm', () => {
  it('devolve a entrada mais antiga, e não a atual', () => {
    // O "desde" da ficha é quando entrou pela primeira vez no clube.
    const historico = [
      { inicioEm: d('2023-05-01') },
      { inicioEm: d('2018-01-10'), fimEm: d('2020-02-01') },
    ]
    expect(primeiraFiliacaoEm(historico)).toEqual(d('2018-01-10'))
  })

  it('devolve nada sem histórico', () => {
    expect(primeiraFiliacaoEm([])).toBeNull()
  })
})

describe('diasDeFiliacao', () => {
  it('não conta o tempo em que a pessoa esteve fora', () => {
    const historico = [
      { inicioEm: d('2020-01-01'), fimEm: d('2020-01-11') }, // 10 dias
      { inicioEm: d('2024-01-01'), fimEm: d('2024-01-06') }, // 5 dias
    ]
    expect(diasDeFiliacao(historico)).toBe(15)
  })

  it('conta o período aberto até hoje', () => {
    const historico = [{ inicioEm: d('2026-08-01') }]
    expect(diasDeFiliacao(historico, d('2026-08-21'))).toBe(20)
  })

  it('ignora período invertido em vez de subtrair', () => {
    expect(diasDeFiliacao([{ inicioEm: d('2024-05-01'), fimEm: d('2024-04-01') }])).toBe(0)
  })
})

describe('periodoConflita', () => {
  const existentes = [
    { inicioEm: d('2018-01-01'), fimEm: d('2020-01-01') },
    { inicioEm: d('2023-01-01'), fimEm: d('2024-01-01') },
  ]

  it('aceita período que cabe no intervalo livre', () => {
    expect(periodoConflita({ inicioEm: d('2021-01-01'), fimEm: d('2022-01-01') }, existentes))
      .toBe(false)
  })

  it('recusa período que invade um existente', () => {
    expect(periodoConflita({ inicioEm: d('2019-06-01'), fimEm: d('2021-01-01') }, existentes))
      .toBe(true)
  })

  it('recusa período que engloba um existente', () => {
    expect(periodoConflita({ inicioEm: d('2017-01-01'), fimEm: d('2025-01-01') }, existentes))
      .toBe(true)
  })

  it('recusa período aberto que alcança um existente', () => {
    // Filiação aberta em 2022 atropela a de 2023 em diante.
    expect(periodoConflita({ inicioEm: d('2022-01-01') }, existentes)).toBe(true)
  })

  it('aceita período aberto começando depois de tudo', () => {
    expect(periodoConflita({ inicioEm: d('2024-06-01') }, existentes)).toBe(false)
  })

  it('não considera conflito encostar exatamente no fim do anterior', () => {
    // Saiu em 01/01/2020 e voltou no mesmo dia: é sequência, não sobreposição.
    expect(periodoConflita({ inicioEm: d('2020-01-01'), fimEm: d('2021-01-01') }, existentes))
      .toBe(false)
  })

  it('sem histórico, nada conflita', () => {
    expect(periodoConflita({ inicioEm: d('2020-01-01') }, [])).toBe(false)
  })
})

describe('periodoValido', () => {
  it('recusa fim anterior ao início', () => {
    expect(periodoValido({ inicioEm: d('2024-05-01'), fimEm: d('2024-04-01') })).toBe(false)
  })

  it('aceita período em aberto', () => {
    expect(periodoValido({ inicioEm: d('2024-05-01') })).toBe(true)
  })
})
