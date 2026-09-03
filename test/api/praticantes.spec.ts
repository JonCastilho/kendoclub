import { beforeAll, describe, expect, it } from 'vitest'
import { comoDiretoria, dadosDePraticante, enviar, gerarCpf, ler } from './ajudantes'

let diretoria = ''

beforeAll(async () => {
  diretoria = await comoDiretoria()
}, 60_000)

/** E-mail distinto por teste: o e-mail de contato pode repetir, mas ajuda achar. */
let contador = 0
const proximoEmail = () => `p${++contador}@teste.local`

describe('cadastro pelos dois caminhos de envio', () => {
  it('aceita o envio com JavaScript, que responde em JSON', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: 'Cadastro Por Json',
      documento: gerarCpf(2001),
      email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.ok).toBe(true)
    expect(resposta.destino).toMatch(/^\/praticantes\/.+/)
  })

  it('aceita o envio nativo, que responde com redirecionamento', async () => {
    // Sem JavaScript o formulário é enviado pelo próprio navegador. Este caminho
    // e o de cima precisam entender o mesmo corpo — quando divergiram, todo
    // campo chegou vazio ao servidor e ninguém notou até o uso real.
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: 'Cadastro Nativo',
      documento: gerarCpf(2002),
      email: proximoEmail(),
    }), { cookie: diretoria, nativo: true })

    expect(resposta.status).toBe(303)
    expect(resposta.destino).toMatch(/\/praticantes\/.+/)
  })

  it('o praticante cadastrado aparece na listagem', async () => {
    const { dados } = await ler<{ praticantes: Array<{ nomeCompleto: string }> }>(
      '/api/praticantes?busca=Cadastro', diretoria)

    expect(dados.praticantes.map(p => p.nomeCompleto)).toEqual(
      expect.arrayContaining(['Cadastro Por Json', 'Cadastro Nativo']))
  })
})

describe('validação do documento', () => {
  it('recusa CPF com dígito errado', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      documento: '529.982.247-26', email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('CPF inválido')
  })

  it('recusa o mesmo CPF próprio duas vezes', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      // O mesmo documento do primeiro cadastro deste arquivo.
      nomeCompleto: 'Documento Repetido', documento: gerarCpf(2001), email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toMatch(/já existe praticante/i)
  })

  it('aceita irmãos com o mesmo documento do responsável', async () => {
    // O caso que motivou o índice parcial: menor sem CPF usa o da mãe, e os
    // dois filhos repetem o número.
    const irmao = (nome: string) => dadosDePraticante({
      nomeCompleto: nome,
      dataNascimento: '2015-04-02',
      documento: gerarCpf(2004),
      titularDocumento: 'RESPONSAVEL',
      email: proximoEmail(),
      responsavelNome: 'Mãe de Tal',
      responsavelTelefone: '11 91111-1111',
      responsavelConsentimento: 'on',
    })

    const primeiro = await enviar('/api/praticantes', irmao('Irmão Um'), { cookie: diretoria })
    const segundo = await enviar('/api/praticantes', irmao('Irmã Dois'), { cookie: diretoria })

    expect(primeiro.ok).toBe(true)
    expect(segundo.ok).toBe(true)
  })

  it('não valida dígitos de documento estrangeiro', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: 'Praticante Estrangeiro',
      documento: 'FX-8842910',
      tipoDocumento: 'DOCUMENTO_ESTRANGEIRO',
      email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.ok).toBe(true)
  })
})

describe('regras que dependem da idade', () => {
  it('exige responsável para menor de idade', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: 'Menor Sem Responsável',
      dataNascimento: '2015-04-02',
      documento: gerarCpf(2005),
      email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('responsável')
  })

  it('recusa documento de responsável para maior de idade', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      titularDocumento: 'RESPONSAVEL', documento: gerarCpf(2006), email: proximoEmail(),
    }), { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('menor de idade')
  })
})

describe('campos que o servidor não pode assumir', () => {
  it('exige o sexo em vez de escolher um', async () => {
    // O servidor assumia "masculino" quando o campo não vinha, gravando um dado
    // que ninguém informou.
    const dados = dadosDePraticante({ documento: gerarCpf(2007), email: proximoEmail() })
    delete (dados as Record<string, string>).sexo

    const resposta = await enviar('/api/praticantes', dados, { cookie: diretoria })
    expect(resposta.problemas.join(' ')).toContain('sexo')
  })

  it('exige a data de filiação', async () => {
    const dados = dadosDePraticante({ documento: gerarCpf(2008), email: proximoEmail() })
    delete (dados as Record<string, string>).filiacaoInicioEm

    const resposta = await enviar('/api/praticantes', dados, { cookie: diretoria })
    expect(resposta.problemas.join(' ')).toContain('data de filiação')
  })

  it('recusa observação médica sem consentimento de saúde', async () => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      documento: gerarCpf(2009),
      email: proximoEmail(),
      observacoesMedicas: 'Asma.',
    }), { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('dados de saúde')
  })
})

describe('dado sensível fora da listagem', () => {
  it('a lista não devolve documento nem observação médica', async () => {
    const { dados } = await ler<{ praticantes: Array<Record<string, unknown>> }>(
      '/api/praticantes', diretoria)

    const primeiro = dados.praticantes[0]!
    expect(primeiro).not.toHaveProperty('documento')
    expect(primeiro).not.toHaveProperty('observacoesMedicas')
  })
})
