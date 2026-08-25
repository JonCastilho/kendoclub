import { describe, expect, it } from 'vitest'
import {
  type CondicoesDoAluguel,
  aluguelAberto,
  descricaoDoAluguel,
  itemEstaAlugado,
  problemasParaAlugar,
  problemasParaDevolver,
} from '../shared/aluguel'

const HOJE = new Date('2026-08-25')
const d = (iso: string) => new Date(iso)

/** Clube que controla patrimônio: aluguel vinculado a um item. */
function comItem(sobrescreve: Partial<CondicoesDoAluguel> = {}): CondicoesDoAluguel {
  return {
    item: { situacao: 'DISPONIVEL', jaAlugado: false },
    temDescricao: false,
    praticanteFiliado: true,
    inicioEm: d('2026-08-01'),
    ...sobrescreve,
  }
}

/** Clube que só quer a taxa na mensalidade: sem item, só descrição. */
function semItem(sobrescreve: Partial<CondicoesDoAluguel> = {}): CondicoesDoAluguel {
  return {
    item: null,
    temDescricao: true,
    praticanteFiliado: true,
    inicioEm: d('2026-08-01'),
    ...sobrescreve,
  }
}

describe('itemEstaAlugado', () => {
  it('período em aberto significa alugado', () => {
    expect(itemEstaAlugado([{ inicioEm: d('2025-01-01') }])).toBe(true)
  })

  it('devolvido não está alugado', () => {
    expect(itemEstaAlugado([{ inicioEm: d('2025-01-01'), fimEm: d('2025-06-01') }])).toBe(false)
  })

  it('encontra o aluguel aberto no meio do histórico', () => {
    const historico = [
      { inicioEm: d('2023-01-01'), fimEm: d('2023-12-01') },
      { inicioEm: d('2025-03-01') },
      { inicioEm: d('2022-01-01'), fimEm: d('2022-05-01') },
    ]
    expect(aluguelAberto(historico)?.inicioEm).toEqual(d('2025-03-01'))
  })

  it('sem histórico, não está alugado', () => {
    expect(itemEstaAlugado([])).toBe(false)
  })
})

describe('descricaoDoAluguel', () => {
  it('usa o item quando existe', () => {
    expect(descricaoDoAluguel({ item: { nome: 'Bogu completo', identificador: 'BG-01' } }))
      .toBe('Bogu completo (BG-01)')
  })

  it('dispensa o patrimônio quando não há', () => {
    expect(descricaoDoAluguel({ item: { nome: 'Bogu completo' } })).toBe('Bogu completo')
  })

  it('usa a descrição livre quando não há item', () => {
    expect(descricaoDoAluguel({ descricao: 'Kote', item: null })).toBe('Kote')
  })

  it('o item vence a descrição, para não desencontrar do cadastro', () => {
    expect(descricaoDoAluguel({ descricao: 'texto velho', item: { nome: 'Men' } })).toBe('Men')
  })

  it('não deixa a linha da mensalidade sem rótulo', () => {
    expect(descricaoDoAluguel({ descricao: '  ', item: null })).toBe('Equipamento')
  })
})

describe('aluguel com item (clube que controla patrimônio)', () => {
  it('aceita item disponível para praticante filiado', () => {
    expect(problemasParaAlugar(comItem(), HOJE)).toEqual([])
  })

  it('recusa item baixado', () => {
    expect(problemasParaAlugar(comItem({ item: { situacao: 'BAIXADO', jaAlugado: false } }), HOJE))
      .toContain('Item baixado não pode ser alugado.')
  })

  it('recusa item em manutenção', () => {
    expect(problemasParaAlugar(comItem({ item: { situacao: 'MANUTENCAO', jaAlugado: false } }), HOJE))
      .toContain('Item em manutenção não pode ser alugado.')
  })

  it('recusa item que já está com alguém', () => {
    expect(problemasParaAlugar(comItem({ item: { situacao: 'DISPONIVEL', jaAlugado: true } }), HOJE))
      .toContain('Este item já está com outro praticante.')
  })

  it('não cobra descrição quando há item', () => {
    expect(problemasParaAlugar(comItem({ temDescricao: false }), HOJE)).toEqual([])
  })
})

describe('aluguel sem item (clube que só cobra a taxa)', () => {
  it('aceita quando há descrição', () => {
    expect(problemasParaAlugar(semItem(), HOJE)).toEqual([])
  })

  it('exige descrição, senão a linha da mensalidade sai sem dizer do quê', () => {
    expect(problemasParaAlugar(semItem({ temDescricao: false }), HOJE))
      .toContain('Descreva o que está sendo alugado.')
  })

  it('não aplica regra de item nenhum', () => {
    // Sem inventário não existe "em manutenção" nem "já está com outro".
    expect(problemasParaAlugar(semItem(), HOJE)).toEqual([])
  })
})

describe('regras comuns aos dois modos', () => {
  it('recusa praticante desligado', () => {
    // A partir da etapa 4 o aluguel vira cobrança: alugar para quem saiu
    // geraria mensalidade para alguém que não é mais do clube.
    for (const condicoes of [comItem({ praticanteFiliado: false }), semItem({ praticanteFiliado: false })]) {
      expect(problemasParaAlugar(condicoes, HOJE))
        .toContain('Praticante desligado não pode alugar item.')
    }
  })

  it('recusa retirada com data futura', () => {
    expect(problemasParaAlugar(comItem({ inicioEm: d('2026-12-01') }), HOJE))
      .toContain('A retirada não pode ter data no futuro.')
  })

  it('acumula os impedimentos em vez de parar no primeiro', () => {
    const tudoErrado = comItem({
      item: { situacao: 'BAIXADO', jaAlugado: true },
      praticanteFiliado: false,
    })
    expect(problemasParaAlugar(tudoErrado, HOJE)).toHaveLength(3)
  })
})

describe('problemasParaDevolver', () => {
  it('aceita devolução posterior à retirada', () => {
    expect(problemasParaDevolver({ inicioEm: d('2026-01-01'), fimEm: d('2026-08-01') }, HOJE))
      .toEqual([])
  })

  it('recusa devolução anterior à retirada', () => {
    expect(problemasParaDevolver({ inicioEm: d('2026-08-01'), fimEm: d('2026-01-01') }, HOJE))
      .toHaveLength(1)
  })

  it('recusa devolução no futuro', () => {
    expect(problemasParaDevolver({ inicioEm: d('2026-01-01'), fimEm: d('2026-12-01') }, HOJE))
      .toHaveLength(1)
  })

  it('aceita devolução no mesmo dia da retirada', () => {
    expect(problemasParaDevolver({ inicioEm: d('2026-08-01'), fimEm: d('2026-08-01') }, HOJE))
      .toEqual([])
  })
})
