import { describe, expect, it } from 'vitest'
import {
  apenasDigitos,
  cpfValido,
  formatarCpf,
  normalizarDocumento,
  problemasDoDocumento,
} from '../shared/documento'

// CPFs de exemplo conhecidos por serem bem formados, usados como referência
// externa: se a implementação discordar deles, o erro é da implementação.
const CPF_VALIDO = '529.982.247-25'
const OUTRO_CPF_VALIDO = '111.444.777-35'

describe('cpfValido', () => {
  it('aceita CPF bem formado, com ou sem pontuação', () => {
    expect(cpfValido(CPF_VALIDO)).toBe(true)
    expect(cpfValido(apenasDigitos(CPF_VALIDO))).toBe(true)
    expect(cpfValido(OUTRO_CPF_VALIDO)).toBe(true)
  })

  it('recusa dígito verificador errado', () => {
    expect(cpfValido('529.982.247-26')).toBe(false)
    expect(cpfValido('111.444.777-30')).toBe(false)
  })

  it('recusa quantidade errada de dígitos', () => {
    expect(cpfValido('529982247')).toBe(false)
    expect(cpfValido('5299822472555')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })

  it('recusa sequência de dígitos repetidos', () => {
    // Passam no cálculo dos verificadores, mas nenhuma é CPF de verdade.
    for (const d of '0123456789') {
      expect(cpfValido(d.repeat(11))).toBe(false)
    }
  })
})

describe('normalizarDocumento', () => {
  it('guarda CPF só com números', () => {
    expect(normalizarDocumento(CPF_VALIDO, 'CPF')).toBe('52998224725')
  })

  it('preserva documento estrangeiro como digitado', () => {
    // Passaporte tem letra; tirar os não-dígitos destruiria o documento.
    expect(normalizarDocumento(' FX-8842910 ', 'DOCUMENTO_ESTRANGEIRO')).toBe('FX-8842910')
  })
})

describe('formatarCpf', () => {
  it('devolve com pontuação', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
  })

  it('não mexe no que não é CPF', () => {
    expect(formatarCpf('FX-8842910')).toBe('FX-8842910')
  })
})

describe('problemasDoDocumento', () => {
  it('aceita CPF válido', () => {
    expect(problemasDoDocumento(CPF_VALIDO, 'CPF')).toEqual([])
  })

  it('reclama de CPF inválido', () => {
    expect(problemasDoDocumento('529.982.247-26', 'CPF')).toHaveLength(1)
  })

  it('não valida dígitos de documento estrangeiro', () => {
    // A conferência é do CPF; documento estrangeiro não tem formato único.
    expect(problemasDoDocumento('FX-8842910', 'DOCUMENTO_ESTRANGEIRO')).toEqual([])
    expect(problemasDoDocumento('12345', 'DOCUMENTO_ESTRANGEIRO')).toEqual([])
  })

  it('exige que o documento exista', () => {
    expect(problemasDoDocumento('', 'CPF')).toHaveLength(1)
    expect(problemasDoDocumento('   ', 'DOCUMENTO_ESTRANGEIRO')).toHaveLength(1)
  })
})
