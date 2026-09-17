import type { Grau } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import type { Shogo } from '../shared/graduacao'
import {
  avisoDeCarencia,
  decidirExame,
  ehAspirante,
  grauPretendido,
  lerMeses,
  opcoesDeExame,
  problemasDaGraduacaoOferecida,
  problemasDoShogoDoPraticante,
  problemasDoShogoOferecido,
  shogoPretendido,
  somarMeses,
  textoDoAviso,
} from '../shared/exame'

describe('ehAspirante', () => {
  it('é aspirante quem está abaixo do 2º kyu, inclusive mukyu', () => {
    expect(ehAspirante(null)).toBe(true)
    expect(ehAspirante('KYU_6')).toBe(true)
    expect(ehAspirante('KYU_3')).toBe(true)
    expect(ehAspirante('KYU_2')).toBe(false)
    expect(ehAspirante('DAN_1')).toBe(false)
  })
})

describe('grauPretendido', () => {
  it('aspirante vai direto ao 1º kyu', () => {
    expect(grauPretendido(null, 6)).toBe('KYU_1')
    expect(grauPretendido('KYU_5', 6)).toBe('KYU_1')
    expect(grauPretendido('KYU_3', 6)).toBe('KYU_1')
  })

  it('2º kyu vai ao 1º kyu, por ser o seguinte', () => {
    expect(grauPretendido('KYU_2', 6)).toBe('KYU_1')
  })

  it('daí em diante, a graduação seguinte', () => {
    expect(grauPretendido('KYU_1', 6)).toBe('DAN_1')
    expect(grauPretendido('DAN_1', 6)).toBe('DAN_2')
    expect(grauPretendido('DAN_7', 6)).toBe('DAN_8')
  })

  it('não há graduação depois do 8º dan', () => {
    expect(grauPretendido('DAN_8', 6)).toBeNull()
  })
})

describe('shogoPretendido', () => {
  it('libera Renshi a partir do 5º dan, para quem ainda não tem título', () => {
    expect(shogoPretendido('DAN_4', [])).toBeNull()
    expect(shogoPretendido('DAN_5', [])).toBe('RENSHI')
    expect(shogoPretendido('DAN_8', [])).toBe('RENSHI')
  })

  it('libera Kyoshi para qualquer detentor de Renshi', () => {
    expect(shogoPretendido('DAN_5', ['RENSHI'])).toBe('KYOSHI')
    expect(shogoPretendido('DAN_7', ['RENSHI'])).toBe('KYOSHI')
  })

  it('não libera nada a quem já é Kyoshi, a kyu ou a mukyu', () => {
    expect(shogoPretendido('DAN_7', ['RENSHI', 'KYOSHI'])).toBeNull()
    expect(shogoPretendido('KYU_1', [])).toBeNull()
    expect(shogoPretendido(null, [])).toBeNull()
  })
})

describe('problemasDoShogoDoPraticante', () => {
  const base = { obtidoEm: '2020-05-01', renshiEm: null, hoje: '2026-09-17' }

  it('aceita Renshi para 5º dan e Kyoshi para quem tem Renshi', () => {
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'RENSHI', grau: 'DAN_5' })).toEqual([])
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'KYOSHI', grau: 'DAN_6', renshiEm: '2015-01-01' }))
      .toEqual([])
  })

  it('recusa Renshi abaixo do 5º dan e Kyoshi sem Renshi', () => {
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'RENSHI', grau: 'DAN_4' })[0]).toContain('5º dan')
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'KYOSHI', grau: 'DAN_8' })[0]).toContain('pede Renshi')
  })

  it('exige data, sem futuro e sem Kyoshi antes do Renshi', () => {
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'RENSHI', grau: 'DAN_5', obtidoEm: null }))
      .toHaveLength(1)
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'RENSHI', grau: 'DAN_5', obtidoEm: '2027-01-01' })[0])
      .toContain('futuro')
    expect(problemasDoShogoDoPraticante({ ...base, shogo: 'KYOSHI', grau: 'DAN_7', renshiEm: '2021-01-01' })[0])
      .toContain('anterior ao Renshi')
  })
})

describe('opcoesDeExame e decidirExame', () => {
  const bancas = {
    graduacoes: [{ grau: 'KYU_1' as const }, { grau: 'DAN_1' as const }, { grau: 'DAN_7' as const }],
    shogos: [{ shogo: 'RENSHI' as const }],
  }
  const nenhum = { grau: false, shogo: false }
  const cadastro = (grau: Grau | null, shogos: Shogo[] = []) => ({ grau, shogos })

  it('o título não muda a banca do dan', () => {
    expect(opcoesDeExame(cadastro('DAN_6', ['RENSHI']), 6, bancas)).toEqual({
      grau: 'DAN_7', temBancaDeGrau: true, shogo: 'KYOSHI', temBancaDeShogo: false,
    })
  })

  it('sem escolha possível, não pergunta nada', () => {
    const opcoes = opcoesDeExame(cadastro('KYU_4'), 6, bancas)
    expect(decidirExame(opcoes, nenhum, 'exame')).toEqual({ grau: 'KYU_1', shogo: null, problemas: [] })
  })

  it('com dan e shogo possíveis, exige marcar ao menos um', () => {
    const opcoes = opcoesDeExame(cadastro('DAN_6'), 6, bancas)
    expect(decidirExame(opcoes, nenhum, 'exame').problemas[0]).toContain('ou os dois')
    expect(decidirExame(opcoes, { grau: true, shogo: true }, 'exame'))
      .toEqual({ grau: 'DAN_7', shogo: 'RENSHI', problemas: [] })
    expect(decidirExame(opcoes, { grau: false, shogo: true }, 'exame'))
      .toEqual({ grau: null, shogo: 'RENSHI', problemas: [] })
  })

  it('só shogo com banca: é ele, sem perguntar', () => {
    // 5º dan: não há banca de 6º dan, mas há de Renshi.
    const opcoes = opcoesDeExame(cadastro('DAN_5'), 6, bancas)
    expect(decidirExame(opcoes, nenhum, 'exame')).toEqual({ grau: null, shogo: 'RENSHI', problemas: [] })
  })

  it('sem banca nenhuma, recusa dizendo o que faltou', () => {
    expect(decidirExame(opcoesDeExame(cadastro('DAN_1'), 6, bancas), nenhum, 'exame de kendo').problemas[0])
      .toContain('não haverá banca para 2º dan')
    expect(decidirExame(opcoesDeExame(cadastro('DAN_8', ['RENSHI']), 6, bancas), nenhum, 'exame').problemas[0])
      .toContain('não haverá banca para Kyoshi')
  })

  it('recusa quem já está no 8º dan Kyoshi', () => {
    const opcoes = opcoesDeExame(cadastro('DAN_8', ['RENSHI', 'KYOSHI']), 6, bancas)
    expect(decidirExame(opcoes, nenhum, 'exame').problemas[0]).toContain('máximos')
  })
})

describe('somarMeses', () => {
  it('soma atravessando o ano', () => {
    expect(somarMeses('2025-11-15', 3)).toBe('2026-02-15')
    expect(somarMeses('2020-06-01', 24)).toBe('2022-06-01')
  })

  it('dia que não existe cai no último dia do mês', () => {
    expect(somarMeses('2024-01-31', 1)).toBe('2024-02-29')
    expect(somarMeses('2025-01-31', 1)).toBe('2025-02-28')
  })
})

describe('avisoDeCarencia', () => {
  it('sem regra na tabela, não avisa', () => {
    expect(avisoDeCarencia({ referencia: null, mesesMinimos: null, diaDoExame: '2026-10-01' })).toBeNull()
  })

  it('não avisa quem cumpre, inclusive no dia exato', () => {
    expect(avisoDeCarencia({ referencia: '2024-10-01', mesesMinimos: 24, diaDoExame: '2026-10-01' }))
      .toBeNull()
  })

  it('avisa quem não cumpre, com a data em que passa a cumprir', () => {
    expect(avisoDeCarencia({ referencia: '2025-06-01', mesesMinimos: 24, diaDoExame: '2026-10-01' }))
      .toEqual({ tipo: 'NAO_CUMPRIDA', cumpreEm: '2027-06-01' })
  })

  it('avisa quando não há data para conferir', () => {
    expect(avisoDeCarencia({ referencia: null, mesesMinimos: 12, diaDoExame: '2026-10-01' }))
      .toEqual({ tipo: 'DATA_DESCONHECIDA' })
  })

  it('descreve o aviso', () => {
    expect(textoDoAviso({ tipo: 'NAO_CUMPRIDA', cumpreEm: '2027-06-01' })).toContain('01/06/2027')
    expect(textoDoAviso({ tipo: 'DATA_DESCONHECIDA' })).toContain('desconhecida')
  })
})

describe('lerMeses', () => {
  it('vazio tira a regra, número é número, o resto é inválido', () => {
    expect(lerMeses('')).toBeNull()
    expect(lerMeses('24')).toBe(24)
    expect(lerMeses('dois anos')).toBeNaN()
  })
})

describe('problemasDoShogoOferecido', () => {
  it('aceita Renshi e Kyoshi com valor, e recusa o resto', () => {
    expect(problemasDoShogoOferecido({ shogo: 'KYOSHI', valor: 300 })).toEqual([])
    expect(problemasDoShogoOferecido({ shogo: 'HANSHI', valor: 300 })).toHaveLength(1)
    expect(problemasDoShogoOferecido({ shogo: 'RENSHI', valor: null })).toHaveLength(1)
  })
})

describe('problemasDaGraduacaoOferecida', () => {
  it('aceita 1º kyu e dans, com valor', () => {
    expect(problemasDaGraduacaoOferecida({ grau: 'KYU_1', valor: 120 }, 6)).toEqual([])
    expect(problemasDaGraduacaoOferecida({ grau: 'DAN_3', valor: 0 }, 6)).toEqual([])
  })

  it('recusa kyu abaixo do 1º, que não tem banca', () => {
    expect(problemasDaGraduacaoOferecida({ grau: 'KYU_3', valor: 50 }, 6)).toHaveLength(1)
  })

  it('exige valor, distinguindo vazio de zero', () => {
    expect(problemasDaGraduacaoOferecida({ grau: 'DAN_1', valor: null }, 6)[0]).toContain('Use 0')
  })
})
