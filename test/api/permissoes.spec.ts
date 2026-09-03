import { beforeAll, describe, expect, it } from 'vitest'
import { comoDiretoria, dadosDePraticante, enviar, gerarCpf, ler } from './ajudantes'

/**
 * A matriz de permissão, que até aqui só era conferida à mão.
 *
 * É o teste mais importante do conjunto: esconder um botão é conveniência, e a
 * barreira de verdade está no servidor. Se ela ceder, ninguém percebe pela tela.
 */

let diretoria = ''
let praticanteCookie = ''
let praticanteId = ''
let mensalidadeDeOutro = ''

beforeAll(async () => {
  diretoria = await comoDiretoria()

  // Um praticante com acesso próprio, para testar o que ele NÃO pode.
  const criado = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Dono do Acesso',
    documento: gerarCpf(1001),
    email: 'dono@teste.local',
  }), { cookie: diretoria })

  praticanteId = criado.destino.split('/').pop()!

  const acesso = await enviar(`/api/praticantes/${praticanteId}/acesso`, {}, { cookie: diretoria })
  const link = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '')
  const token = link.split('t=')[1] ?? ''

  await enviar('/api/auth/redefinir-senha', {
    token, senha: 'senha do praticante', confirmacao: 'senha do praticante',
  })

  const { entrar } = await import('./ajudantes')
  praticanteCookie = await entrar('dono@teste.local', 'senha do praticante')

  // Cobrança de um segundo praticante, que o primeiro não pode tocar.
  const outro = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Outro Praticante',
    documento: gerarCpf(1002),
    email: 'outro@teste.local',
  }), { cookie: diretoria })
  const outroId = outro.destino.split('/').pop()!

  await enviar('/api/configuracoes', {
    nomeClube: 'Clube de Teste', valorMensalidade: '150', diaVencimento: '10',
  }, { cookie: diretoria })
  await enviar('/api/mensalidades/gerar', { competencia: '2026-08' }, { cookie: diretoria })

  const { dados } = await ler<{ mensalidades: Array<{ id: string, praticante: { id: string } }> }>(
    '/api/mensalidades?competencia=2026-08', diretoria)
  mensalidadeDeOutro = dados.mensalidades.find(m => m.praticante.id === outroId)!.id
}, 120_000)

describe('sem sessão', () => {
  it.each([
    '/api/praticantes',
    '/api/mensalidades',
    '/api/itens',
    '/api/configuracoes',
    '/api/painel/resumo',
    '/api/modalidades',
  ])('%s responde 401', async (caminho) => {
    const { status } = await ler(caminho)
    expect(status).toBe(401)
  })

  it('não deixa criar praticante', async () => {
    const { status } = await enviar('/api/praticantes', dadosDePraticante())
    expect(status).toBe(401)
  })
})

describe('praticante nas rotas da diretoria', () => {
  it.each([
    '/api/praticantes',
    '/api/mensalidades',
    '/api/itens',
    '/api/configuracoes',
    '/api/painel/resumo',
  ])('%s responde 403', async (caminho) => {
    const { status } = await ler(caminho, praticanteCookie)
    expect(status).toBe(403)
  })

  it('não cria praticante', async () => {
    const { status } = await enviar('/api/praticantes', dadosDePraticante({ documento: gerarCpf(1003) }),
      { cookie: praticanteCookie })
    expect(status).toBe(403)
  })

  it('não gera cobranças', async () => {
    const { status } = await enviar('/api/mensalidades/gerar', { competencia: '2026-09' },
      { cookie: praticanteCookie })
    expect(status).toBe(403)
  })

  it('não dá baixa em cobrança', async () => {
    const { status } = await enviar(`/api/mensalidades/${mensalidadeDeOutro}/baixa`,
      { pagaEm: '2026-08-05' }, { cookie: praticanteCookie })
    expect(status).toBe(403)
  })

  it('não recusa declaração de pagamento', async () => {
    const { status } = await enviar(`/api/mensalidades/${mensalidadeDeOutro}/declaracao`,
      { acao: 'recusar', motivoRecusa: 'eu mesmo' }, { cookie: praticanteCookie })
    expect(status).toBe(403)
  })
})

describe('praticante e os dados de outro praticante', () => {
  it('não declara pagamento em cobrança alheia', async () => {
    const { status } = await enviar(`/api/mensalidades/${mensalidadeDeOutro}/declaracao`,
      { pagoEm: '2026-08-05' }, { cookie: praticanteCookie })
    expect(status).toBe(403)
  })

  it('só enxerga as próprias mensalidades', async () => {
    const { dados } = await ler<{ mensalidades: Array<{ id: string }> }>(
      '/api/mensalidades/minhas', praticanteCookie)

    expect(dados.mensalidades.every(m => m.id !== mensalidadeDeOutro)).toBe(true)
  })
})

describe('a diretoria continua podendo', () => {
  it('lê a lista de praticantes', async () => {
    const { status } = await ler('/api/praticantes', diretoria)
    expect(status).toBe(200)
  })

  it('lê a ficha completa', async () => {
    const { status } = await ler(`/api/praticantes/${praticanteId}`, diretoria)
    expect(status).toBe(200)
  })
})
