import { beforeAll, describe, expect, it } from 'vitest'
import { comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * O caminho do dinheiro: geração, baixa, estorno e declaração de pagamento.
 *
 * Usa uma competência própria (2026-05) para não disputar com os outros
 * arquivos, que compartilham o mesmo banco.
 */

const COMPETENCIA = '2026-05'

interface Mensalidade {
  id: string
  situacao: string
  valorTotal: string
  observacao: string | null
  praticante: { id: string, nomeCompleto: string }
  linhas: Array<{ tipo: string, descricao: string, valor: string }>
  declaracoes: Array<{ analisadaEm: string | null, aceita: boolean | null, motivoRecusa: string | null }>
}

let diretoria = ''
const ids: Record<string, string> = {}

async function criar(nome: string, semente: number, extra: Record<string, string> = {}) {
  const resposta = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: nome,
    documento: gerarCpf(semente),
    email: `c${semente}@teste.local`,
    ...extra,
  }), { cookie: diretoria })

  if (!resposta.ok) throw new Error(`${nome}: ${resposta.problemas.join('; ')}`)
  return resposta.destino.split('/').pop()!
}

async function mensalidadeDe(nome: string): Promise<Mensalidade | undefined> {
  const { dados } = await ler<{ mensalidades: Mensalidade[] }>(
    `/api/mensalidades?competencia=${COMPETENCIA}`, diretoria)
  return dados.mensalidades.find(m => m.praticante.nomeCompleto === nome)
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/configuracoes', {
    nomeClube: 'Clube de Teste',
    valorMensalidade: '150',
    valorAluguelPadrao: '45',
    diaVencimento: '10',
    regraCobrancaAluguel: 'ABERTO_NO_PRIMEIRO_DIA',
  }, { cookie: diretoria })

  ids.antigo = await criar('Cobrança Filiado Antigo', 3001)
  ids.doMeio = await criar('Cobrança Filiou No Meio', 3002, { filiacaoInicioEm: '2026-05-15' })
  ids.isento = await criar('Cobrança Isento', 3003)
  ids.comBogu = await criar('Cobrança Com Bogu', 3004)
  ids.tardio = await criar('Cobrança Alugou Dia 20', 3005)

  await enviar(`/api/praticantes/${ids.isento}/isencoes`, {
    inicioEm: '2026-01-01', motivo: 'Estudante bolsista', abrangencia: 'TUDO',
  }, { cookie: diretoria })

  await enviar(`/api/praticantes/${ids.comBogu}/alugueis`, {
    descricao: 'Bogu', valorMensal: '45', inicioEm: '2026-01-01',
  }, { cookie: diretoria })

  await enviar(`/api/praticantes/${ids.tardio}/alugueis`, {
    descricao: 'Kote', valorMensal: '30', inicioEm: '2026-05-20',
  }, { cookie: diretoria })

  await enviar('/api/mensalidades/gerar', { competencia: COMPETENCIA }, { cookie: diretoria })
}, 180_000)

describe('geração do mês', () => {
  it('cobra quem já era filiado no primeiro dia', async () => {
    const m = await mensalidadeDe('Cobrança Filiado Antigo')
    expect(m?.situacao).toBe('ABERTA')
    expect(Number(m?.valorTotal)).toBe(150)
  })

  it('NÃO cobra quem se filiou no meio do mês', async () => {
    expect(await mensalidadeDe('Cobrança Filiou No Meio')).toBeUndefined()
  })

  it('gera cobrança isenta, com o motivo escrito na linha', async () => {
    const m = await mensalidadeDe('Cobrança Isento')
    expect(m?.situacao).toBe('ISENTA')
    expect(Number(m?.valorTotal)).toBe(0)
    expect(m?.linhas[0]?.descricao).toContain('Estudante bolsista')
  })

  it('soma o aluguel como linha própria', async () => {
    const m = await mensalidadeDe('Cobrança Com Bogu')
    expect(Number(m?.valorTotal)).toBe(195)
    // A mensalidade aparece antes do aluguel porque o Postgres ordena enum pela
    // ordem de declaração, não em ordem alfabética — e é a ordem que se quer ler.
    expect(m?.linhas.map(l => l.tipo)).toEqual(['MENSALIDADE', 'ALUGUEL'])
  })

  it('não cobra aluguel retirado no meio do mês', async () => {
    const m = await mensalidadeDe('Cobrança Alugou Dia 20')
    expect(Number(m?.valorTotal)).toBe(150)
    expect(m?.linhas).toHaveLength(1)
  })

  it('gerar de novo não duplica', async () => {
    const resposta = await enviar('/api/mensalidades/gerar', { competencia: COMPETENCIA },
      { cookie: diretoria })

    expect(resposta.destino).toContain('criadas=0')
  })

  it('recusa competência inválida', async () => {
    const resposta = await enviar('/api/mensalidades/gerar', { competencia: '2026-13' },
      { cookie: diretoria })
    expect(resposta.problemas.join(' ')).toContain('Competência inválida')
  })
})

describe('baixa e estorno', () => {
  it('dá baixa registrando quem deu', async () => {
    const m = await mensalidadeDe('Cobrança Filiado Antigo')
    const resposta = await enviar(`/api/mensalidades/${m!.id}/baixa`,
      { pagaEm: '2026-05-05' }, { cookie: diretoria })

    expect(resposta.ok).toBe(true)
    expect((await mensalidadeDe('Cobrança Filiado Antigo'))?.situacao).toBe('PAGA')
  })

  it('recusa baixa em cobrança já paga', async () => {
    const m = await mensalidadeDe('Cobrança Filiado Antigo')
    const resposta = await enviar(`/api/mensalidades/${m!.id}/baixa`,
      { pagaEm: '2026-05-06' }, { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('já está paga')
  })

  it('recusa pagamento com data no futuro', async () => {
    const m = await mensalidadeDe('Cobrança Com Bogu')
    const resposta = await enviar(`/api/mensalidades/${m!.id}/baixa`,
      { pagaEm: '2030-01-01' }, { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('futuro')
  })

  it('estorna deixando registro de quem estornou', async () => {
    const m = await mensalidadeDe('Cobrança Filiado Antigo')
    await enviar(`/api/mensalidades/${m!.id}/baixa`, { acao: 'estornar' }, { cookie: diretoria })

    const depois = await mensalidadeDe('Cobrança Filiado Antigo')
    expect(depois?.situacao).toBe('ABERTA')
    expect(depois?.observacao).toContain('estornada')
  })
})

describe('recálculo e cancelamento', () => {
  it('recalcula depois de um aluguel registrado após a geração', async () => {
    const antes = await mensalidadeDe('Cobrança Alugou Dia 20')
    expect(Number(antes?.valorTotal)).toBe(150)

    await enviar(`/api/praticantes/${ids.tardio}/alugueis`, {
      descricao: 'Men', valorMensal: '20', inicioEm: '2026-01-01',
    }, { cookie: diretoria })

    // A cobrança é um retrato: só muda quando alguém manda recalcular.
    expect(Number((await mensalidadeDe('Cobrança Alugou Dia 20'))?.valorTotal)).toBe(150)

    await enviar(`/api/mensalidades/${antes!.id}/ajuste`, {}, { cookie: diretoria })
    expect(Number((await mensalidadeDe('Cobrança Alugou Dia 20'))?.valorTotal)).toBe(170)
  })

  it('cancela e reabre', async () => {
    const m = await mensalidadeDe('Cobrança Alugou Dia 20')

    await enviar(`/api/mensalidades/${m!.id}/ajuste`, { acao: 'cancelar' }, { cookie: diretoria })
    expect((await mensalidadeDe('Cobrança Alugou Dia 20'))?.situacao).toBe('CANCELADA')

    const recalculo = await enviar(`/api/mensalidades/${m!.id}/ajuste`, {}, { cookie: diretoria })
    expect(recalculo.problemas.join(' ')).toContain('Reabra antes')

    await enviar(`/api/mensalidades/${m!.id}/ajuste`, { acao: 'reabrir' }, { cookie: diretoria })
    expect((await mensalidadeDe('Cobrança Alugou Dia 20'))?.situacao).toBe('ABERTA')
  })
})

describe('declaração de pagamento', () => {
  let praticante = ''
  let mensalidade = ''

  beforeAll(async () => {
    const acesso = await enviar(`/api/praticantes/${ids.comBogu}/acesso`, {}, { cookie: diretoria })
    const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''

    await enviar('/api/auth/redefinir-senha', {
      token, senha: 'senha do declarante', confirmacao: 'senha do declarante',
    })

    praticante = await entrar('c3004@teste.local', 'senha do declarante')
    mensalidade = (await mensalidadeDe('Cobrança Com Bogu'))!.id
  }, 60_000)

  it('o praticante avisa que pagou', async () => {
    const resposta = await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { pagoEm: '2026-05-05', observacao: 'Pix feito' }, { cookie: praticante })

    expect(resposta.ok).toBe(true)
  })

  it('não deixa avisar duas vezes enquanto ninguém conferiu', async () => {
    const resposta = await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { pagoEm: '2026-05-06' }, { cookie: praticante })

    expect(resposta.problemas.join(' ')).toContain('aguardando conferência')
  })

  it('a diretoria vê o aviso na fila', async () => {
    const { dados } = await ler<{ aConferir: number }>(
      `/api/mensalidades?competencia=${COMPETENCIA}`, diretoria)
    expect(dados.aConferir).toBeGreaterThan(0)
  })

  it('recusar exige motivo', async () => {
    const resposta = await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { acao: 'recusar' }, { cookie: diretoria })

    expect(resposta.problemas.join(' ')).toContain('por que')
  })

  it('a recusa chega ao praticante com o motivo', async () => {
    await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { acao: 'recusar', motivoRecusa: 'Não encontrei no extrato' }, { cookie: diretoria })

    const { dados } = await ler<{ mensalidades: Mensalidade[] }>(
      '/api/mensalidades/minhas', praticante)

    const declaracao = dados.mensalidades[0]!.declaracoes[0]!
    expect(declaracao.aceita).toBe(false)
    expect(declaracao.motivoRecusa).toContain('extrato')
  })

  it('dar baixa aceita o aviso pendente', async () => {
    await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { pagoEm: '2026-05-05' }, { cookie: praticante })

    await enviar(`/api/mensalidades/${mensalidade}/baixa`,
      { pagaEm: '2026-05-05' }, { cookie: diretoria })

    const depois = await mensalidadeDe('Cobrança Com Bogu')
    expect(depois?.situacao).toBe('PAGA')
    expect(depois?.declaracoes.every(d => d.analisadaEm !== null)).toBe(true)
  })

  it('não deixa avisar em cobrança já paga', async () => {
    const resposta = await enviar(`/api/mensalidades/${mensalidade}/declaracao`,
      { pagoEm: '2026-05-05' }, { cookie: praticante })

    expect(resposta.problemas.join(' ')).toContain('já está paga')
  })
})
