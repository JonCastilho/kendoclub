import { describe, expect, it } from 'vitest'
import { type DadosDoCadastro, problemasDoCadastro } from '../shared/praticante'

const HOJE = new Date('2026-08-24')

function adulto(sobrescreve: Partial<DadosDoCadastro> = {}): DadosDoCadastro {
  return {
    nomeCompleto: 'Fulano de Tal',
    dataNascimento: new Date('1990-05-10'),
    sexo: 'MASCULINO',
    documento: '529.982.247-25',
    tipoDocumento: 'CPF',
    titularDocumento: 'PROPRIO',
    email: 'fulano@exemplo.org',
    telefone: '11 90000-0000',
    ...sobrescreve,
  }
}

function menor(sobrescreve: Partial<DadosDoCadastro> = {}): DadosDoCadastro {
  return adulto({
    dataNascimento: new Date('2015-04-02'),
    responsavelNome: 'Responsável de Tal',
    responsavelTelefone: '11 91111-1111',
    responsavelConsentimentoEm: HOJE,
    ...sobrescreve,
  })
}

describe('cadastro de adulto', () => {
  it('aceita o cadastro completo', () => {
    expect(problemasDoCadastro(adulto(), HOJE)).toEqual([])
  })

  it('exige nome, e-mail e telefone', () => {
    const problemas = problemasDoCadastro(
      adulto({ nomeCompleto: '  ', email: '', telefone: '' }), HOJE)
    expect(problemas).toHaveLength(3)
  })

  it('recusa data de nascimento no futuro', () => {
    const problemas = problemasDoCadastro(
      adulto({ dataNascimento: new Date('2027-01-01') }), HOJE)
    expect(problemas.join(' ')).toContain('futuro')
  })

  it('recusa CPF inválido', () => {
    const problemas = problemasDoCadastro(adulto({ documento: '529.982.247-26' }), HOJE)
    expect(problemas.join(' ')).toContain('CPF inválido')
  })

  it('não valida dígitos de documento estrangeiro', () => {
    const estrangeiro = adulto({ documento: 'FX-8842910', tipoDocumento: 'DOCUMENTO_ESTRANGEIRO' })
    expect(problemasDoCadastro(estrangeiro, HOJE)).toEqual([])
  })

  it('exige o sexo, em vez de assumir um', () => {
    // Sem escolha não se inventa uma: assumir por omissão é decidir pela pessoa.
    expect(problemasDoCadastro(adulto({ sexo: null }), HOJE).join(' ')).toContain('sexo')
    expect(problemasDoCadastro(adulto({ sexo: '' }), HOJE).join(' ')).toContain('sexo')
  })

  it('recusa valor de sexo fora da lista', () => {
    expect(problemasDoCadastro(adulto({ sexo: 'OUTRO' }), HOJE).join(' ')).toContain('sexo')
  })

  it('aceita os dois valores previstos', () => {
    expect(problemasDoCadastro(adulto({ sexo: 'FEMININO' }), HOJE)).toEqual([])
    expect(problemasDoCadastro(adulto({ sexo: 'MASCULINO' }), HOJE)).toEqual([])
  })

  it('recusa documento de responsável para maior de idade', () => {
    const problemas = problemasDoCadastro(adulto({ titularDocumento: 'RESPONSAVEL' }), HOJE)
    expect(problemas.join(' ')).toContain('menor de idade')
  })
})

describe('cadastro de menor de idade', () => {
  it('aceita quando tem responsável e consentimento', () => {
    expect(problemasDoCadastro(menor(), HOJE)).toEqual([])
  })

  it('exige responsável', () => {
    const problemas = problemasDoCadastro(
      menor({ responsavelNome: '', responsavelTelefone: '' }), HOJE)
    expect(problemas.join(' ')).toContain('responsável')
  })

  it('exige o consentimento do responsável', () => {
    const problemas = problemasDoCadastro(menor({ responsavelConsentimentoEm: null }), HOJE)
    expect(problemas.join(' ')).toContain('consentimento do responsável')
  })

  it('aceita documento do responsável', () => {
    // É a regra combinada: menor sem CPF é cadastrado com o do responsável.
    expect(problemasDoCadastro(menor({ titularDocumento: 'RESPONSAVEL' }), HOJE)).toEqual([])
  })

  it('deixa de exigir responsável no dia dos 18 anos', () => {
    const dezoitoHoje = adulto({ dataNascimento: new Date('2008-08-24') })
    expect(problemasDoCadastro(dezoitoHoje, HOJE)).toEqual([])
  })
})

describe('observações médicas', () => {
  it('exige consentimento específico de saúde', () => {
    const problemas = problemasDoCadastro(
      adulto({ observacoesMedicas: 'Asma. Usa bombinha.' }), HOJE)
    expect(problemas.join(' ')).toContain('dados de saúde')
  })

  it('aceita quando o consentimento existe', () => {
    const com = adulto({ observacoesMedicas: 'Asma.', consentimentoSaudeEm: HOJE })
    expect(problemasDoCadastro(com, HOJE)).toEqual([])
  })

  it('não cobra consentimento quando não há observação médica', () => {
    expect(problemasDoCadastro(adulto({ observacoesMedicas: '   ' }), HOJE)).toEqual([])
  })
})
