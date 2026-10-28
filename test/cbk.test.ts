import { describe, expect, it } from 'vitest'
import {
  type InscricaoParaCbk,
  montarTabelaCbk,
  problemasDaFicha,
} from '../shared/cbk'
import type { SubeventoDetalhado } from '../shared/evento'

const kendo = { id: 'm1', nome: 'Kendo', kyuInicial: 6 }
const iaido = { id: 'm2', nome: 'Iaido', kyuInicial: 5 }

function subevento(parcial: Partial<SubeventoDetalhado> & Pick<SubeventoDetalhado, 'id' | 'tipo'>): SubeventoDetalhado {
  return {
    modalidade: kendo, local: 'Ginásio', dias: ['2026-11-10'], valor: 0, inscritos: 0,
    categorias: [], graduacoes: [], shogos: [], ...parcial,
  }
}

const categoria = (id: string, nome: string, tipo: 'INDIVIDUAL' | 'EQUIPE') => ({
  id, nome, tipo, sexo: 'MISTO' as const, idadeMinima: null, idadeMaxima: null,
  grauMinimo: null, grauMaximo: null, isenta: false, inscritos: 0,
})

const seminario = subevento({ id: 's1', tipo: 'SEMINARIO', dias: ['2026-11-10', '2026-11-11'] })
const exame = subevento({ id: 'e1', tipo: 'EXAME', dias: ['2026-11-11'] })
const competicao = subevento({
  id: 'c1', tipo: 'COMPETICAO',
  categorias: [categoria('ci', 'Adulto', 'INDIVIDUAL'), categoria('ce', 'Equipe adulto', 'EQUIPE')],
})

const nenhuma: Pick<InscricaoParaCbk, 'subeventoIds' | 'obentos' | 'competicoes' | 'exames' | 'fichas'> = {
  subeventoIds: [], obentos: {}, competicoes: {}, exames: {}, fichas: {},
}

const ana: InscricaoParaCbk = {
  praticanteId: 'p1', nome: 'Ana',
  subeventoIds: ['s1', 'c1', 'e1'],
  obentos: { '2026-11-10': 2 },
  competicoes: { c1: { categoriaIndividualId: 'ci', categoriaEquipeId: 'ce' } },
  exames: { e1: { grau: 'DAN_3', shogo: 'RENSHI' } },
  fichas: { c1: { inscricaoSubeventoId: 'i1', nomeNoZekken: 'Silva', posicaoNaEquipe: 'SENPO' } },
}

const beto: InscricaoParaCbk = {
  praticanteId: 'p2', nome: 'Beto',
  subeventoIds: ['c1'],
  obentos: {},
  competicoes: { c1: { categoriaIndividualId: 'ci', categoriaEquipeId: null } },
  exames: {},
  fichas: { c1: { inscricaoSubeventoId: 'i2', nomeNoZekken: null, posicaoNaEquipe: null } },
}

const carla: InscricaoParaCbk = { praticanteId: 'p3', nome: 'Carla', ...nenhuma, obentos: { '2026-11-10': 1 } }

describe('montarTabelaCbk', () => {
  const tabela = montarTabelaCbk([competicao, exame, seminario], ['2026-11-10'], [ana, beto, carla])
  const celula = (nome: string, chave: string) => tabela.linhas.find(l => l.nome === nome)!.celulas[chave]

  it('segue a ordem da planilha, mesmo com os subeventos fora de ordem', () => {
    expect(tabela.colunas.map(c => c.chave)).toEqual([
      'seminario:s1:2026-11-10',
      'seminario:s1:2026-11-11',
      'exame:e1',
      'exame-grau:e1',
      'competicao:c1:individual',
      'competicao:c1:categoria-individual',
      'competicao:c1:equipe',
      'competicao:c1:categoria-equipe',
      'competicao:c1:zekken',
      'obento:2026-11-10',
    ])
  })

  it('mostra S ou N por dia de seminário, e se vai prestar exame', () => {
    expect(celula('Ana', 'seminario:s1:2026-11-10')).toBe('S')
    expect(celula('Ana', 'seminario:s1:2026-11-11')).toBe('S')
    expect(celula('Beto', 'seminario:s1:2026-11-10')).toBe('N')
    expect(celula('Ana', 'exame:e1')).toBe('S')
    expect(celula('Beto', 'exame:e1')).toBe('N')
    expect(celula('Ana', 'exame-grau:e1')).toBe('3º dan e Renshi')
    expect(celula('Beto', 'exame-grau:e1')).toBe('—')
  })

  it('traz as categorias de cada disputa e o que a diretoria anotou', () => {
    expect(celula('Ana', 'competicao:c1:individual')).toBe('S')
    expect(celula('Ana', 'competicao:c1:categoria-individual')).toBe('Adulto')
    expect(celula('Ana', 'competicao:c1:categoria-equipe')).toBe('Equipe adulto')
    expect(celula('Ana', 'competicao:c1:equipe')).toBe('Senpo')
    expect(celula('Ana', 'competicao:c1:zekken')).toBe('Silva')
  })

  it('quem não compete por equipes tem N, e quem compete sem posição definida fica em branco', () => {
    expect(celula('Beto', 'competicao:c1:equipe')).toBe('N')
    expect(celula('Beto', 'competicao:c1:individual')).toBe('S')
    expect(celula('Beto', 'competicao:c1:categoria-equipe')).toBe('—')

    const semPosicao = montarTabelaCbk([competicao], [], [{
      ...ana, fichas: { c1: { inscricaoSubeventoId: 'i1', nomeNoZekken: null, posicaoNaEquipe: null } },
    }])
    expect(semPosicao.linhas[0]!.celulas['competicao:c1:equipe']).toBe('')
  })

  it('conta obentos por dia, inclusive de quem só encomendou', () => {
    expect(celula('Ana', 'obento:2026-11-10')).toBe('2')
    expect(celula('Carla', 'obento:2026-11-10')).toBe('1')
    expect(celula('Beto', 'obento:2026-11-10')).toBe('0')
    expect(celula('Carla', 'competicao:c1:individual')).toBe('N')
  })

  it('só quem compete tem ficha para anotar, e a posição só vale para equipe', () => {
    const fichas = (nome: string) => tabela.linhas.find(l => l.nome === nome)!.fichas
    expect(fichas('Ana')).toEqual([{
      subeventoId: 'c1', inscricaoSubeventoId: 'i1', nomeNoZekken: 'Silva', posicao: 'SENPO', naEquipe: true,
    }])
    expect(fichas('Beto')[0]).toMatchObject({ naEquipe: false })
    expect(fichas('Carla')).toEqual([])
  })

  it('resume quantos competem em cada disputa e quantos são avulsos', () => {
    const avulsa = { ...ana, praticanteId: 'p4', nome: 'Dani', fichas: {
      c1: { inscricaoSubeventoId: 'i4', nomeNoZekken: null, posicaoNaEquipe: 'AVULSO' as const },
    } }
    const resumo = montarTabelaCbk([competicao], [], [ana, beto, avulsa]).resumo
    expect(resumo).toEqual([{ subeventoId: 'c1', rotulo: 'Competição', individuais: 3, equipes: 2, avulsos: 1 }])
  })

  it('com mais de um subevento do mesmo tipo, os rótulos trazem a modalidade', () => {
    const outra = subevento({ id: 'c2', tipo: 'COMPETICAO', modalidade: iaido })
    const duas = montarTabelaCbk([competicao, outra], [], [])
    expect(duas.colunas.filter(c => c.chave.startsWith('competicao:c2')).map(c => c.rotulo)[0])
      .toBe('Competição (Iaido) individual')
    // Com um só, o rótulo fica como na planilha.
    expect(tabela.colunas.find(c => c.chave === 'competicao:c1:individual')!.rotulo).toBe('Competição individual')
  })

  it('só as colunas de zekken e posição são editáveis', () => {
    expect(tabela.colunas.filter(c => c.tipo !== 'TEXTO').map(c => [c.chave, c.tipo])).toEqual([
      ['competicao:c1:equipe', 'POSICAO'],
      ['competicao:c1:zekken', 'ZEKKEN'],
    ])
  })

  it('evento sem inscritos tem as colunas e nenhuma linha', () => {
    const vazia = montarTabelaCbk([seminario], [], [])
    expect(vazia.colunas).toHaveLength(2)
    expect(vazia.linhas).toEqual([])
  })
})

describe('problemasDaFicha', () => {
  const valida = { nome: 'Ana', zekken: 'Silva', posicao: 'SENPO', naEquipe: true }

  it('aceita a ficha completa, e também a vazia', () => {
    expect(problemasDaFicha(valida)).toEqual([])
    expect(problemasDaFicha({ ...valida, zekken: '', posicao: '' })).toEqual([])
  })

  it('aceita avulso, que é uma posição de quem compete por equipes', () => {
    expect(problemasDaFicha({ ...valida, posicao: 'AVULSO' })).toEqual([])
  })

  it('recusa posição para quem não compete por equipes', () => {
    expect(problemasDaFicha({ ...valida, naEquipe: false })[0]).toContain('não compete por equipes')
  })

  it('recusa posição inventada e zekken longo demais', () => {
    expect(problemasDaFicha({ ...valida, posicao: 'REI' })[0]).toContain('posição inválida')
    expect(problemasDaFicha({ ...valida, zekken: 'x'.repeat(41) })[0]).toContain('no máximo 40')
  })
})
