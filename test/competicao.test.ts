import { describe, expect, it } from 'vitest'
import {
  type Categoria,
  type Competidor,
  categoriaServe,
  categoriasCompativeis,
  decidirCompeticao,
  idadeNoAno,
  lerIdade,
  participacaoIsenta,
  problemasDaCategoria,
  rotuloDaFaixaDeGrau,
  rotuloDaIdade,
} from '../shared/competicao'

function categoria(parcial: Partial<Categoria>): Categoria {
  return {
    id: 'c', nome: 'Categoria', tipo: 'INDIVIDUAL', sexo: 'MISTO',
    idadeMinima: null, idadeMaxima: null, grauMinimo: null, grauMaximo: null,
    isenta: false, ...parcial,
  }
}

const adulto: Competidor = { sexo: 'MASCULINO', idade: 30, grau: 'DAN_2' }

describe('idadeNoAno', () => {
  it('conta só o ano, fazendo aniversário antes ou depois do evento', () => {
    expect(idadeNoAno('2008-01-05', '2026-03-14')).toBe(18)
    expect(idadeNoAno('2008-12-30', '2026-03-14')).toBe(18)
  })
})

describe('categoriaServe', () => {
  it('categoria mista aceita os dois sexos', () => {
    expect(categoriaServe(categoria({ sexo: 'MISTO' }), adulto)).toBe(true)
    expect(categoriaServe(categoria({ sexo: 'MISTO' }), { ...adulto, sexo: 'FEMININO' })).toBe(true)
  })

  it('categoria de um sexo recusa o outro', () => {
    expect(categoriaServe(categoria({ sexo: 'FEMININO' }), adulto)).toBe(false)
  })

  it('faixa de idade inclui os extremos', () => {
    const faixa = categoria({ idadeMinima: 18, idadeMaxima: 30 })
    expect(categoriaServe(faixa, { ...adulto, idade: 18 })).toBe(true)
    expect(categoriaServe(faixa, { ...adulto, idade: 30 })).toBe(true)
    expect(categoriaServe(faixa, { ...adulto, idade: 17 })).toBe(false)
    expect(categoriaServe(faixa, { ...adulto, idade: 31 })).toBe(false)
  })

  it('faixa em branco não limita', () => {
    expect(categoriaServe(categoria({ idadeMinima: 18 }), { ...adulto, idade: 80 })).toBe(true)
    expect(categoriaServe(categoria({ idadeMaxima: 12 }), { ...adulto, idade: 6 })).toBe(true)
  })

  it('faixa de graduação compara kyu e dan na ordem certa', () => {
    const faixa = categoria({ grauMinimo: 'KYU_3', grauMaximo: 'DAN_1' })
    expect(categoriaServe(faixa, { ...adulto, grau: 'KYU_3' })).toBe(true)
    expect(categoriaServe(faixa, { ...adulto, grau: 'KYU_1' })).toBe(true)
    expect(categoriaServe(faixa, { ...adulto, grau: 'DAN_1' })).toBe(true)
    expect(categoriaServe(faixa, { ...adulto, grau: 'KYU_4' })).toBe(false)
    expect(categoriaServe(faixa, { ...adulto, grau: 'DAN_2' })).toBe(false)
  })

  it('mukyu fica abaixo de todo grau', () => {
    const mukyu = { ...adulto, grau: null }
    expect(categoriaServe(categoria({ grauMaximo: 'KYU_2' }), mukyu)).toBe(true)
    expect(categoriaServe(categoria({ grauMinimo: 'KYU_6' }), mukyu)).toBe(false)
  })
})

describe('categoriasCompativeis', () => {
  it('filtra pelas três condições juntas', () => {
    const tabela = [
      categoria({ id: 'adulto-m', sexo: 'MASCULINO', idadeMinima: 18 }),
      categoria({ id: 'adulto-f', sexo: 'FEMININO', idadeMinima: 18 }),
      categoria({ id: 'juvenil', idadeMaxima: 17 }),
      categoria({ id: 'dan', grauMinimo: 'DAN_1' }),
    ]
    expect(categoriasCompativeis(tabela, adulto).map(c => c.id)).toEqual(['adulto-m', 'dan'])
  })
})

describe('decidirCompeticao', () => {
  const compativeis = [
    { id: 'i1', tipo: 'INDIVIDUAL' as const },
    { id: 'i2', tipo: 'INDIVIDUAL' as const },
    { id: 'e1', tipo: 'EQUIPE' as const },
  ]
  const nenhuma = { individual: '', equipe: '' }

  it('aceita uma categoria de cada disputa', () => {
    expect(decidirCompeticao({ individual: 'i2', equipe: 'e1' }, compativeis, 'Competição')).toEqual({
      categoriaIndividualId: 'i2', categoriaEquipeId: 'e1', problemas: [],
    })
  })

  it('aceita competir só numa das disputas', () => {
    expect(decidirCompeticao({ ...nenhuma, individual: 'i1' }, compativeis, 'C')).toEqual({
      categoriaIndividualId: 'i1', categoriaEquipeId: null, problemas: [],
    })
    expect(decidirCompeticao({ ...nenhuma, equipe: 'e1' }, compativeis, 'C')).toEqual({
      categoriaIndividualId: null, categoriaEquipeId: 'e1', problemas: [],
    })
  })

  it('exige ao menos uma disputa', () => {
    const { problemas } = decidirCompeticao(nenhuma, compativeis, 'C')
    expect(problemas[0]).toContain('individual, por equipes')
  })

  it('recusa categoria que não serve, mesmo existindo no evento', () => {
    const { categoriaIndividualId, problemas } = decidirCompeticao({ ...nenhuma, individual: 'outra' }, compativeis, 'C')
    expect(categoriaIndividualId).toBeNull()
    expect(problemas[0]).toContain('não atende')
  })

  it('recusa categoria de equipe escolhida na disputa individual, e o inverso', () => {
    expect(decidirCompeticao({ ...nenhuma, individual: 'e1' }, compativeis, 'C').problemas[0])
      .toContain('não atende')
    expect(decidirCompeticao({ ...nenhuma, equipe: 'i1' }, compativeis, 'C').problemas[0])
      .toContain('não atende')
  })

  it('quando nenhuma categoria da disputa serve, aponta a tabela', () => {
    const soIndividuais = compativeis.filter(c => c.tipo === 'INDIVIDUAL')
    const { categoriaEquipeId, problemas } = decidirCompeticao({ ...nenhuma, equipe: 'e1' }, soIndividuais, 'Competição de Kendo')
    expect(categoriaEquipeId).toBeNull()
    expect(problemas[0]).toContain('tabela de categorias')
  })
})

describe('participacaoIsenta', () => {
  it('só é gratuita se todas as categorias escolhidas são isentas', () => {
    expect(participacaoIsenta([{ isenta: true }])).toBe(true)
    expect(participacaoIsenta([{ isenta: true }, { isenta: true }])).toBe(true)
    expect(participacaoIsenta([{ isenta: true }, { isenta: false }])).toBe(false)
    expect(participacaoIsenta([{ isenta: false }])).toBe(false)
  })

  it('sem categoria escolhida ou não encontrada, paga', () => {
    expect(participacaoIsenta([])).toBe(false)
    expect(participacaoIsenta([{ isenta: true }, undefined])).toBe(false)
  })
})

describe('problemasDaCategoria', () => {
  const valida = {
    nome: 'Adulto masculino', tipo: 'INDIVIDUAL', sexo: 'MASCULINO', idadeMinima: 18, idadeMaxima: null,
    grauMinimo: null, grauMaximo: null,
  }

  it('aceita categoria completa', () => {
    expect(problemasDaCategoria(valida, 6)).toEqual([])
  })

  it('exige nome, tipo e sexo', () => {
    expect(problemasDaCategoria({ ...valida, nome: '', tipo: '', sexo: '' }, 6)).toHaveLength(3)
  })

  it('aceita os dois tipos e recusa o resto', () => {
    expect(problemasDaCategoria({ ...valida, tipo: 'EQUIPE' }, 6)).toEqual([])
    expect(problemasDaCategoria({ ...valida, tipo: 'TRIO' }, 6)[0]).toContain('individual ou por equipes')
  })

  it('recusa faixa de idade invertida ou inválida', () => {
    expect(problemasDaCategoria({ ...valida, idadeMinima: 30, idadeMaxima: 18 }, 6)).toHaveLength(1)
    expect(problemasDaCategoria({ ...valida, idadeMinima: Number.NaN }, 6)).toHaveLength(1)
  })

  it('recusa faixa de graduação invertida', () => {
    expect(problemasDaCategoria({ ...valida, grauMinimo: 'DAN_1', grauMaximo: 'KYU_3' }, 6))
      .toHaveLength(1)
  })

  it('recusa graduação fora da modalidade', () => {
    // Modalidade que começa no 5º kyu não tem 6º kyu.
    expect(problemasDaCategoria({ ...valida, grauMinimo: 'KYU_6' }, 5)).toHaveLength(1)
  })
})

describe('lerIdade', () => {
  it('vazio é sem limite, número é número, o resto é inválido', () => {
    expect(lerIdade('')).toBeNull()
    expect(lerIdade(' 18 ')).toBe(18)
    expect(lerIdade('18 anos')).toBeNaN()
  })
})

describe('rótulos', () => {
  it('descreve a faixa de idade', () => {
    expect(rotuloDaIdade(18, 35)).toBe('18 a 35 anos')
    expect(rotuloDaIdade(18, null)).toBe('a partir de 18 anos')
    expect(rotuloDaIdade(null, 12)).toBe('até 12 anos')
    expect(rotuloDaIdade(null, null)).toBe('qualquer idade')
  })

  it('descreve a faixa de graduação', () => {
    expect(rotuloDaFaixaDeGrau('KYU_3', 'DAN_1')).toBe('3º kyu a 1º dan')
    expect(rotuloDaFaixaDeGrau('DAN_1', null)).toBe('a partir de 1º dan')
    expect(rotuloDaFaixaDeGrau(null, 'KYU_2')).toBe('até 2º kyu')
    expect(rotuloDaFaixaDeGrau(null, null)).toBe('qualquer graduação')
  })
})
