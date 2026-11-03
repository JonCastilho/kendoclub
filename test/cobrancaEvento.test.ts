import { describe, expect, it } from 'vitest'
import {
  cobrancaAtualizada,
  estadoDoPagamento,
  inscricaoTravada,
  itensDaInscricao,
  ordenarPagamentos,
  problemasDaAcao,
  problemasDaRecusa,
  resumirPagamentos,
  situacaoDaCobranca,
} from '../shared/cobrancaEvento'

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

describe('situacaoDaCobranca', () => {
  const quando = new Date()

  it('sem declaração nem análise, só gerada', () => {
    expect(situacaoDaCobranca({ declaradaEm: null, analisadaEm: null, aceita: null })).toBe('GERADA')
  })

  it('declarada e ainda não analisada, em análise', () => {
    expect(situacaoDaCobranca({ declaradaEm: quando, analisadaEm: null, aceita: null })).toBe('EM_ANALISE')
  })

  it('aceita, paga — com ou sem declaração, que é o caso da baixa direta', () => {
    expect(situacaoDaCobranca({ declaradaEm: quando, analisadaEm: quando, aceita: true })).toBe('PAGA')
    expect(situacaoDaCobranca({ declaradaEm: null, analisadaEm: quando, aceita: true })).toBe('PAGA')
  })

  it('recusada volta a gerada: a pessoa pode declarar de novo', () => {
    expect(situacaoDaCobranca({ declaradaEm: quando, analisadaEm: quando, aceita: false })).toBe('GERADA')
  })
})

describe('inscricaoTravada', () => {
  it('trava com o pagamento declarado ou confirmado, e só então', () => {
    expect(inscricaoTravada('EM_ANALISE')).toBe(true)
    expect(inscricaoTravada('PAGA')).toBe(true)
    expect(inscricaoTravada('GERADA')).toBe(false)
    expect(inscricaoTravada(null)).toBe(false)
  })
})

describe('problemasDaRecusa', () => {
  it('exige o motivo, que é o que a pessoa lê, e limita o tamanho', () => {
    expect(problemasDaRecusa('  ')[0]).toContain('por que')
    expect(problemasDaRecusa('Valor diferente do Pix')).toEqual([])
    expect(problemasDaRecusa('x'.repeat(201))[0]).toContain('200')
  })
})

describe('problemasDaAcao', () => {
  it('aceitar e recusar só valem para comprovante em análise', () => {
    expect(problemasDaAcao('aceitar', 'EM_ANALISE', true)).toEqual([])
    expect(problemasDaAcao('recusar', 'EM_ANALISE', false)).toEqual([])
    expect(problemasDaAcao('aceitar', 'GERADA', true)[0]).toContain('Não há comprovante')
    expect(problemasDaAcao('recusar', 'PAGA', true)[0]).toContain('Não há comprovante')
  })

  it('dar baixa vale para Pix em dia, ainda não declarado nem pago', () => {
    expect(problemasDaAcao('baixar', 'GERADA', true)).toEqual([])
    expect(problemasDaAcao('baixar', 'GERADA', false)[0]).toContain('Gere um novo')
    expect(problemasDaAcao('baixar', 'EM_ANALISE', true)[0]).toContain('aceite ou recuse')
    expect(problemasDaAcao('baixar', 'PAGA', true)[0]).toContain('já foi confirmado')
  })

  it('estornar só vale para pagamento confirmado', () => {
    expect(problemasDaAcao('estornar', 'PAGA', true)).toEqual([])
    expect(problemasDaAcao('estornar', 'GERADA', true)[0]).toContain('confirmado')
  })

  it('recusa ação inventada', () => {
    expect(problemasDaAcao('apagar', 'PAGA', true)[0]).toContain('inválida')
  })
})

describe('estado, ordem e resumo dos pagamentos', () => {
  const cobranca = (situacao: 'GERADA' | 'EM_ANALISE' | 'PAGA', atualizada = true, valor = 50) => ({
    id: 'c', valor, situacao, atualizada, declaradaEm: null, analisadaEm: null,
    motivoRecusa: null, temComprovante: false, observacao: null,
  })
  const linha = (nome: string, total: number, c: ReturnType<typeof cobranca> | null) => ({ nome, total, cobranca: c })

  it('deriva o estado da cobrança e do total', () => {
    expect(estadoDoPagamento(linha('a', 0, null))).toBe('GRATUITA')
    expect(estadoDoPagamento(linha('a', 50, null))).toBe('SEM_PIX')
    expect(estadoDoPagamento(linha('a', 50, cobranca('GERADA')))).toBe('GERADA')
    expect(estadoDoPagamento(linha('a', 60, cobranca('GERADA', false)))).toBe('DESATUALIZADA')
    expect(estadoDoPagamento(linha('a', 50, cobranca('EM_ANALISE')))).toBe('EM_ANALISE')
    expect(estadoDoPagamento(linha('a', 50, cobranca('PAGA')))).toBe('PAGA')
    // Pago continua pago mesmo que a inscrição tenha mudado depois.
    expect(estadoDoPagamento(linha('a', 60, cobranca('PAGA', false)))).toBe('PAGA')
  })

  it('põe o que pede conferência primeiro, e desempata pelo nome', () => {
    const ordenadas = ordenarPagamentos([
      linha('Zé', 50, cobranca('PAGA')),
      linha('Bia', 50, null),
      linha('Ana', 50, cobranca('EM_ANALISE')),
      linha('Caio', 50, cobranca('EM_ANALISE')),
      linha('Dani', 50, cobranca('GERADA')),
    ])
    expect(ordenadas.map(l => l.nome)).toEqual(['Ana', 'Caio', 'Dani', 'Bia', 'Zé'])
  })

  it('resume por estado e soma o confirmado, em centavos', () => {
    const resumo = resumirPagamentos([
      linha('a', 50.1, cobranca('PAGA', true, 50.1)),
      linha('b', 20.2, cobranca('PAGA', true, 20.2)),
      linha('c', 30, cobranca('EM_ANALISE', true, 30)),
      linha('d', 40, null),
      linha('e', 0, null),
    ])
    expect(resumo.porEstado).toMatchObject({ PAGA: 2, EM_ANALISE: 1, SEM_PIX: 1, GRATUITA: 1 })
    expect(resumo.confirmado).toBe(70.3)
    expect(resumo.esperado).toBe(140.3)
  })
})
