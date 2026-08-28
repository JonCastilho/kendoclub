import { describe, expect, it } from 'vitest'
import {
  type CondicoesDaDeclaracao,
  declaracaoPendente,
  problemasParaDeclarar,
  ultimaRecusa,
} from '../shared/declaracao'

const HOJE = new Date('2026-08-27')
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

function condicoes(sobrescreve: Partial<CondicoesDaDeclaracao> = {}): CondicoesDaDeclaracao {
  return {
    situacaoDaMensalidade: 'ABERTA',
    jaTemPendente: false,
    pagoEm: d('2026-08-20'),
    ...sobrescreve,
  }
}

describe('declaracaoPendente', () => {
  it('acha a que ainda não foi conferida', () => {
    const lista = [
      { pagoEm: d('2026-07-05'), analisadaEm: d('2026-07-06'), aceita: true },
      { pagoEm: d('2026-08-20') },
    ]
    expect(declaracaoPendente(lista)?.pagoEm).toEqual(d('2026-08-20'))
  })

  it('devolve nada quando tudo já foi analisado', () => {
    const lista = [{ pagoEm: d('2026-07-05'), analisadaEm: d('2026-07-06'), aceita: true }]
    expect(declaracaoPendente(lista)).toBeNull()
  })

  it('sem declarações, não há pendente', () => {
    expect(declaracaoPendente([])).toBeNull()
  })
})

describe('ultimaRecusa', () => {
  it('devolve a recusa mais recente', () => {
    const lista = [
      { pagoEm: d('2026-06-01'), analisadaEm: d('2026-06-02'), aceita: false, motivoRecusa: 'antiga' },
      { pagoEm: d('2026-07-01'), analisadaEm: d('2026-07-02'), aceita: false, motivoRecusa: 'recente' },
    ]
    expect(ultimaRecusa(lista)?.motivoRecusa).toBe('recente')
  })

  it('ignora as aceitas', () => {
    const lista = [{ pagoEm: d('2026-06-01'), analisadaEm: d('2026-06-02'), aceita: true }]
    expect(ultimaRecusa(lista)).toBeNull()
  })

  it('ignora as pendentes', () => {
    expect(ultimaRecusa([{ pagoEm: d('2026-08-20') }])).toBeNull()
  })
})

describe('problemasParaDeclarar', () => {
  it('aceita cobrança em aberto sem pendência', () => {
    expect(problemasParaDeclarar(condicoes(), HOJE)).toEqual([])
  })

  it('recusa cobrança já paga', () => {
    expect(problemasParaDeclarar(condicoes({ situacaoDaMensalidade: 'PAGA' }), HOJE))
      .toContain('Esta cobrança já está paga.')
  })

  it('recusa cobrança isenta ou cancelada', () => {
    for (const situacao of ['ISENTA', 'CANCELADA']) {
      expect(problemasParaDeclarar(condicoes({ situacaoDaMensalidade: situacao }), HOJE))
        .toHaveLength(1)
    }
  })

  it('recusa segunda declaração enquanto a primeira não foi conferida', () => {
    expect(problemasParaDeclarar(condicoes({ jaTemPendente: true }), HOJE))
      .toContain('Já existe um aviso de pagamento aguardando conferência.')
  })

  it('recusa pagamento com data no futuro', () => {
    expect(problemasParaDeclarar(condicoes({ pagoEm: d('2026-12-01') }), HOJE))
      .toContain('A data do pagamento não pode estar no futuro.')
  })

  it('aceita pagamento declarado hoje', () => {
    expect(problemasParaDeclarar(condicoes({ pagoEm: HOJE }), HOJE)).toEqual([])
  })

  it('aceita pagamento retroativo', () => {
    // Alguém pagou em julho e só avisa em agosto — comum.
    expect(problemasParaDeclarar(condicoes({ pagoEm: d('2026-07-02') }), HOJE)).toEqual([])
  })
})
