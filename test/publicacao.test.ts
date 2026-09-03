import { describe, expect, it } from 'vitest'
import {
  type Leitor,
  VISITANTE,
  estaPublicada,
  gerarSlug,
  podeVer,
  problemasDaPublicacao,
} from '../shared/publicacao'

const LOGADO: Leitor = { logado: true, ehDiretoria: false }
const DIRETORIA: Leitor = { logado: true, ehDiretoria: true }

const publicada = (visibilidade: 'PUBLICA' | 'RESTRITA') => ({
  visibilidade, publicadaEm: new Date('2026-08-01'),
})
const rascunho = (visibilidade: 'PUBLICA' | 'RESTRITA') => ({ visibilidade, publicadaEm: null })

describe('estaPublicada', () => {
  it('sem data de publicação é rascunho', () => {
    expect(estaPublicada(rascunho('PUBLICA'))).toBe(false)
  })

  it('com data está publicada', () => {
    expect(estaPublicada(publicada('PUBLICA'))).toBe(true)
  })
})

describe('podeVer — o que o visitante anônimo enxerga', () => {
  it('vê publicação pública já publicada', () => {
    expect(podeVer(publicada('PUBLICA'), VISITANTE)).toBe(true)
  })

  it('NÃO vê publicação restrita', () => {
    // O erro que mais importa evitar: post restrito exposto na internet.
    expect(podeVer(publicada('RESTRITA'), VISITANTE)).toBe(false)
  })

  it('NÃO vê rascunho, mesmo público', () => {
    expect(podeVer(rascunho('PUBLICA'), VISITANTE)).toBe(false)
  })
})

describe('podeVer — praticante autenticado', () => {
  it('vê publicação pública', () => {
    expect(podeVer(publicada('PUBLICA'), LOGADO)).toBe(true)
  })

  it('vê publicação restrita', () => {
    expect(podeVer(publicada('RESTRITA'), LOGADO)).toBe(true)
  })

  it('não vê rascunho', () => {
    expect(podeVer(rascunho('RESTRITA'), LOGADO)).toBe(false)
    expect(podeVer(rascunho('PUBLICA'), LOGADO)).toBe(false)
  })
})

describe('podeVer — diretoria', () => {
  it('vê tudo, inclusive rascunho', () => {
    expect(podeVer(rascunho('RESTRITA'), DIRETORIA)).toBe(true)
    expect(podeVer(rascunho('PUBLICA'), DIRETORIA)).toBe(true)
    expect(podeVer(publicada('RESTRITA'), DIRETORIA)).toBe(true)
  })
})

describe('gerarSlug', () => {
  it('tira acento e espaço', () => {
    expect(gerarSlug('Exame de graduação em março')).toBe('exame-de-graduacao-em-marco')
  })

  it('não deixa hífen nas pontas', () => {
    expect(gerarSlug('  Treino!  ')).toBe('treino')
  })

  it('junta pontuação repetida num hífen só', () => {
    expect(gerarSlug('Campeonato 2026 — inscrições abertas!!!'))
      .toBe('campeonato-2026-inscricoes-abertas')
  })

  it('preserva números', () => {
    expect(gerarSlug('3º Torneio')).toBe('3-torneio')
  })

  it('devolve vazio quando não há letra nem número', () => {
    expect(gerarSlug('!!! ???')).toBe('')
  })

  it('corta título muito longo sem terminar em hífen', () => {
    const slug = gerarSlug('palavra '.repeat(30))
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('problemasDaPublicacao', () => {
  it('aceita título e conteúdo preenchidos', () => {
    expect(problemasDaPublicacao({ titulo: 'Treino de sábado', conteudo: 'Teremos treino.' }))
      .toEqual([])
  })

  it('exige título', () => {
    expect(problemasDaPublicacao({ titulo: '  ', conteudo: 'algo' }))
      .toContain('Informe o título.')
  })

  it('exige conteúdo', () => {
    expect(problemasDaPublicacao({ titulo: 'Treino', conteudo: '  ' }))
      .toContain('Escreva o conteúdo da publicação.')
  })

  it('recusa título sem letra nem número, que não geraria endereço', () => {
    expect(problemasDaPublicacao({ titulo: '!!!', conteudo: 'algo' }).join(' '))
      .toContain('letras ou números')
  })
})
