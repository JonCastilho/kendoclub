import { describe, expect, it } from 'vitest'
import {
  type DadosDoEvento,
  diaDe,
  diasDoEvento,
  diasRemovidos,
  ehDiaValido,
  formatarDia,
  hojeNoFuso,
  inscricoesAbertas,
  normalizarInscricao,
  periodoDoEvento,
  problemasDoEvento,
  problemasDoSubevento,
  problemasParaPublicar,
  totaisDeObentoPorDia,
  totalDaInscricao,
} from '../shared/evento'

describe('dias', () => {
  it('aceita só datas que existem', () => {
    expect(ehDiaValido('2026-03-14')).toBe(true)
    expect(ehDiaValido('2028-02-29')).toBe(true)
    expect(ehDiaValido('2026-02-30')).toBe(false)
    expect(ehDiaValido('14/03/2026')).toBe(false)
    expect(ehDiaValido('')).toBe(false)
  })

  it('lê o dia de uma data gravada como meia-noite UTC', () => {
    expect(diaDe(new Date('2026-03-14T00:00:00.000Z'))).toBe('2026-03-14')
    expect(diaDe('2026-03-14T00:00:00.000Z')).toBe('2026-03-14')
  })

  it('formata com o dia da semana', () => {
    expect(formatarDia('2026-03-14')).toBe('sáb, 14/03/2026')
  })
})

describe('prazo de inscrição', () => {
  it('usa o dia do fuso do clube, não o do servidor', () => {
    // 22h de 14/03 em Brasília já é 15/03 em UTC.
    const agora = new Date('2026-03-15T01:00:00.000Z')
    expect(hojeNoFuso('America/Sao_Paulo', agora)).toBe('2026-03-14')
    expect(hojeNoFuso('UTC', agora)).toBe('2026-03-15')
  })

  it('continua aberto no próprio dia do prazo', () => {
    expect(inscricoesAbertas('2026-03-14', '2026-03-13')).toBe(true)
    expect(inscricoesAbertas('2026-03-14', '2026-03-14')).toBe(true)
    expect(inscricoesAbertas('2026-03-14', '2026-03-15')).toBe(false)
  })
})

describe('período do evento', () => {
  const subeventos = [
    { dias: ['2026-03-15', '2026-03-14'] },
    // Seminário e exame no mesmo dia: o dia aparece uma vez só.
    { dias: ['2026-03-14', '2026-03-16'] },
  ]

  it('junta os dias dos subeventos, sem repetir e em ordem', () => {
    expect(diasDoEvento(subeventos)).toEqual(['2026-03-14', '2026-03-15', '2026-03-16'])
  })

  it('vai do primeiro ao último dia', () => {
    expect(periodoDoEvento(subeventos)).toEqual({ inicio: '2026-03-14', fim: '2026-03-16' })
  })

  it('não tem período enquanto nenhum subevento tem data', () => {
    expect(periodoDoEvento([])).toBeNull()
  })
})

describe('problemasDoEvento', () => {
  const valido: DadosDoEvento = {
    titulo: 'Taikai de outono',
    descricao: 'Campeonato regional.',
    prazoInscricao: '2026-03-01',
    ofereceAlojamento: false,
    valorAlojamento: null,
    enderecoAlojamento: null,
    valorObento: null,
    diasObento: [],
  }
  const dias = ['2026-03-14', '2026-03-15']

  it('aceita evento completo', () => {
    expect(problemasDoEvento(valido, dias)).toEqual([])
  })

  it('exige título, descrição e prazo', () => {
    const problemas = problemasDoEvento(
      { ...valido, titulo: '', descricao: ' ', prazoInscricao: '' }, [])
    expect(problemas).toHaveLength(3)
  })

  it('recusa prazo depois do primeiro dia', () => {
    const problemas = problemasDoEvento({ ...valido, prazoInscricao: '2026-03-15' }, dias)
    expect(problemas[0]).toContain('primeiro dia')
  })

  it('aceita prazo no próprio primeiro dia', () => {
    expect(problemasDoEvento({ ...valido, prazoInscricao: '2026-03-14' }, dias)).toEqual([])
  })

  it('não limita o prazo enquanto não há subevento com data', () => {
    expect(problemasDoEvento({ ...valido, prazoInscricao: '2030-01-01' }, [])).toEqual([])
  })

  it('exige valor e endereço quando oferece alojamento', () => {
    const problemas = problemasDoEvento({ ...valido, ofereceAlojamento: true }, dias)
    expect(problemas).toHaveLength(2)
  })

  it('aceita alojamento gratuito', () => {
    const problemas = problemasDoEvento({
      ...valido, ofereceAlojamento: true, valorAlojamento: 0, enderecoAlojamento: 'Ginásio',
    }, dias)
    expect(problemas).toEqual([])
  })

  it('exige valor quando há dia de obento', () => {
    const problemas = problemasDoEvento({ ...valido, diasObento: ['2026-03-14'] }, dias)
    expect(problemas[0]).toContain('valor do obento')
  })

  it('recusa obento em dia sem subevento', () => {
    const problemas = problemasDoEvento(
      { ...valido, valorObento: 25, diasObento: ['2026-03-20'] }, dias)
    expect(problemas[0]).toContain('dia que tenha subevento')
  })
})

describe('problemasDoSubevento', () => {
  const valido = {
    tipo: 'SEMINARIO', modalidadeId: 'kendo', local: 'Ginásio', dias: ['2026-03-14'], valor: 80,
  }

  it('aceita seminário completo', () => {
    expect(problemasDoSubevento(valido)).toEqual([])
  })

  it('aceita seminário gratuito', () => {
    expect(problemasDoSubevento({ ...valido, valor: 0 })).toEqual([])
  })

  it('exige valor do seminário, distinguindo vazio de zero', () => {
    expect(problemasDoSubevento({ ...valido, valor: null })[0]).toContain('Use 0')
  })

  it('exige modalidade, local e ao menos um dia', () => {
    expect(problemasDoSubevento({ ...valido, modalidadeId: '', local: '', dias: [] })).toHaveLength(3)
  })

  it('recusa dia inválido', () => {
    expect(problemasDoSubevento({ ...valido, dias: ['2026-02-30'] })).toHaveLength(1)
  })

  it('exige valor de participação também na competição', () => {
    expect(problemasDoSubevento({ ...valido, tipo: 'COMPETICAO' })).toEqual([])
    expect(problemasDoSubevento({ ...valido, tipo: 'COMPETICAO', valor: null })[0]).toContain('Use 0')
  })

  it('ainda não aceita exame', () => {
    expect(problemasDoSubevento({ ...valido, tipo: 'EXAME' })).toHaveLength(1)
  })
})

describe('problemasParaPublicar', () => {
  it('exige subevento com data', () => {
    expect(problemasParaPublicar([])).toHaveLength(1)
    expect(problemasParaPublicar([{ dias: ['2026-03-14'] }])).toEqual([])
  })

  it('exige categoria em toda competição', () => {
    const problemas = problemasParaPublicar([
      { dias: ['2026-03-14'], tipo: 'COMPETICAO', categorias: 0, nome: 'competição de kendo' },
    ])
    expect(problemas).toEqual(['Cadastre ao menos uma categoria em competição de kendo antes de publicar.'])

    expect(problemasParaPublicar([
      { dias: ['2026-03-14'], tipo: 'COMPETICAO', categorias: 2 },
    ])).toEqual([])
  })
})

describe('diasRemovidos', () => {
  it('lista os dias que saíram', () => {
    expect(diasRemovidos(['2026-03-14', '2026-03-15'], ['2026-03-15'])).toEqual(['2026-03-14'])
    expect(diasRemovidos(['2026-03-14'], ['2026-03-14', '2026-03-15'])).toEqual([])
  })
})

describe('normalizarInscricao', () => {
  const evento = {
    subeventoIds: ['seminario-kendo', 'seminario-iaido'],
    ofereceAlojamento: true,
    diasObento: ['2026-03-14', '2026-03-15'],
  }

  it('mantém o que foi escolhido', () => {
    const { inscricao, problemas, vazia } = normalizarInscricao({
      subeventoIds: ['seminario-kendo'],
      alojamento: true,
      obentos: { '2026-03-14': 2 },
    }, evento)

    expect(problemas).toEqual([])
    expect(vazia).toBe(false)
    expect(inscricao).toEqual({
      subeventoIds: ['seminario-kendo'],
      alojamento: true,
      obentos: { '2026-03-14': 2 },
    })
  })

  it('aceita inscrição só com obento, para quem vai dar apoio', () => {
    const { vazia, problemas } = normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-15': 1 },
    }, evento)

    expect(problemas).toEqual([])
    expect(vazia).toBe(false)
  })

  it('trata inscrição sem subevento e sem obento como desistência', () => {
    const { vazia, problemas } = normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-14': 0 },
    }, evento)

    expect(problemas).toEqual([])
    expect(vazia).toBe(true)
  })

  it('desmarca o alojamento de quem não participa de nenhum subevento', () => {
    const { inscricao, problemas } = normalizarInscricao({
      subeventoIds: [], alojamento: true, obentos: { '2026-03-14': 1 },
    }, evento)

    expect(problemas).toEqual([])
    expect(inscricao.alojamento).toBe(false)
  })

  it('ignora alojamento quando o evento não oferece', () => {
    const { inscricao } = normalizarInscricao({
      subeventoIds: ['seminario-kendo'], alojamento: true, obentos: {},
    }, { ...evento, ofereceAlojamento: false })

    expect(inscricao.alojamento).toBe(false)
  })

  it('descarta dia com quantidade zero', () => {
    const { inscricao } = normalizarInscricao({
      subeventoIds: ['seminario-kendo'], alojamento: false, obentos: { '2026-03-14': 0 },
    }, evento)

    expect(inscricao.obentos).toEqual({})
  })

  it('recusa subevento de outro evento', () => {
    const { problemas } = normalizarInscricao({
      subeventoIds: ['subevento-alheio'], alojamento: false, obentos: {},
    }, evento)

    expect(problemas).toHaveLength(1)
  })

  it('recusa obento em dia sem oferta', () => {
    const { problemas } = normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-16': 1 },
    }, evento)

    expect(problemas[0]).toContain('oferta')
  })

  it('recusa quantidade negativa ou fracionada', () => {
    expect(normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-14': -1 },
    }, evento).problemas).toHaveLength(1)

    expect(normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-14': 1.5 },
    }, evento).problemas).toHaveLength(1)

  })

  it('não limita a quantidade por dia', () => {
    const { inscricao, problemas } = normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-14': 120 },
    }, evento)

    expect(problemas).toEqual([])
    expect(inscricao.obentos).toEqual({ '2026-03-14': 120 })
  })

  it('recusa número maior do que o banco guarda, em vez de estourar lá', () => {
    expect(normalizarInscricao({
      subeventoIds: [], alojamento: false, obentos: { '2026-03-14': 2_147_483_648 },
    }, evento).problemas).toHaveLength(1)
  })

  it('não repete subevento marcado duas vezes', () => {
    const { inscricao } = normalizarInscricao({
      subeventoIds: ['seminario-kendo', 'seminario-kendo'], alojamento: false, obentos: {},
    }, evento)

    expect(inscricao.subeventoIds).toEqual(['seminario-kendo'])
  })
})

describe('totalDaInscricao', () => {
  it('soma subeventos, alojamento e obentos', () => {
    expect(totalDaInscricao({
      valoresDosSubeventos: ['80.00', 50],
      alojamento: true,
      valorAlojamento: '120.00',
      quantidadeDeObentos: 3,
      valorObento: '25.50',
    })).toBe(326.5)
  })

  it('não cobra alojamento de quem não pediu', () => {
    expect(totalDaInscricao({
      valoresDosSubeventos: [80],
      alojamento: false,
      valorAlojamento: 120,
      quantidadeDeObentos: 0,
      valorObento: null,
    })).toBe(80)
  })

  it('soma centavos sem erro de ponto flutuante', () => {
    expect(totalDaInscricao({
      valoresDosSubeventos: [0.1, 0.2],
      alojamento: false,
      valorAlojamento: null,
      quantidadeDeObentos: 0,
      valorObento: null,
    })).toBe(0.3)
  })
})

describe('totaisDeObentoPorDia', () => {
  it('soma por dia entre as inscrições', () => {
    expect(totaisDeObentoPorDia([
      { obentos: [{ dia: '2026-03-14', quantidade: 2 }, { dia: '2026-03-15', quantidade: 1 }] },
      { obentos: [{ dia: '2026-03-14', quantidade: 3 }] },
      { obentos: [] },
    ])).toEqual({ '2026-03-14': 5, '2026-03-15': 1 })
  })
})
