import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { LinhaDePagamento, ResumoDePagamentos } from '../../shared/cobrancaEvento'
import type { EventoDetalhado, InscritosDoEvento } from '../../shared/evento'
import {
  ENDERECO,
  comoDiretoria,
  dadosDePraticante,
  entrar,
  enviar,
  enviarArquivo,
  gerarCpf,
  ler,
} from './ajudantes'

/**
 * Pagamento do evento (etapa 7.4b-2): comprovante, declaração, análise da
 * diretoria e baixa.
 *
 * Três cadastros:
 * - Ana, com acesso: seminário de R$ 30 e 2 obentos de R$ 20 (R$ 70);
 * - Dani, com acesso, que não é dona de nenhuma inscrição: tenta ver o que não é dela;
 * - Beto, sem acesso: quem a diretoria inscreve e dá baixa direta.
 */

let diretoria = ''
let ana = ''
let dani = ''
let modalidade = ''
const ids: Record<string, string> = {}

const DIA = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
const prazo = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)

/** Um PNG de mentira: a assinatura certa, seguida de recheio. */
function png(tamanho = 256): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(tamanho)
  bytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0)
  return bytes
}

const pastaDosComprovantes = join(process.cwd(), 'uploads', 'comprovantes')
const arquivosNoDisco = () => (existsSync(pastaDosComprovantes) ? readdirSync(pastaDosComprovantes) : [])

interface Torneio {
  eventoId: string
  slug: string
  seminario: string
}

async function torneio(titulo: string): Promise<Torneio> {
  const criado = await enviar('/api/eventos', {
    titulo, descricao: 'Seminário.', prazoInscricao: prazo, visibilidade: 'PUBLICA',
  }, { cookie: diretoria })
  if (!criado.ok) throw new Error(`${titulo}: ${criado.problemas.join('; ')}`)
  const eventoId = criado.destino.split('/').pop()!

  await enviar('/api/eventos/subeventos', {
    eventoId, tipo: 'SEMINARIO', modalidadeId: modalidade, local: 'Dojo', dia_1: DIA, valor: '30,00',
  }, { cookie: diretoria })
  await enviar('/api/eventos', {
    id: eventoId, titulo, descricao: 'Seminário.', prazoInscricao: prazo,
    valorObento: '20', [`obento_${DIA}`]: 'on',
  }, { cookie: diretoria })

  const publicado = await enviar('/api/eventos/publicar', { id: eventoId }, { cookie: diretoria })
  if (!publicado.ok) throw new Error(`${titulo}: ${publicado.problemas.join('; ')}`)

  const { dados } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)
  return { eventoId, slug: dados.slug, seminario: dados.subeventos[0]!.id }
}

function inscrever(t: Torneio, quem: { cookie: string, praticanteId?: string }, obentos: number) {
  return enviar('/api/eventos/inscricao', {
    eventoId: t.eventoId, [`subevento_${t.seminario}`]: 'on', [`obento_${DIA}`]: String(obentos),
    ...(quem.praticanteId ? { praticanteId: quem.praticanteId } : {}),
  }, { cookie: quem.cookie })
}

const gerar = (t: Torneio, cookie: string, extra: Record<string, string> = {}) =>
  enviar('/api/eventos/pix', { eventoId: t.eventoId, ...extra }, { cookie })

const declarar = (t: Torneio, cookie: string, bytes: Uint8Array<ArrayBuffer> = png()) =>
  enviarArquivo('/api/eventos/comprovante', { eventoId: t.eventoId },
    { nome: 'comprovante.png', tipo: 'image/png', bytes, campo: 'comprovante' }, { cookie })

const decidir = (cobrancaId: string, acao: string, extra: Record<string, string> = {}) =>
  enviar('/api/eventos/pagamento', { cobrancaId, acao, ...extra }, { cookie: diretoria })

const detalhe = async (t: Torneio, cookie: string, query = '') =>
  (await ler<EventoDetalhado>(`/api/eventos/${t.slug}${query}`, cookie)).dados

const pagamentos = async (t: Torneio) =>
  (await ler<{ resumo: ResumoDePagamentos, linhas: LinhaDePagamento[] }>(
    `/api/eventos/${t.eventoId}/pagamentos`, diretoria)).dados

/** Ana inscrita, com o Pix gerado e pronto para pagar. */
async function inscritaComPix(titulo: string) {
  const t = await torneio(titulo)
  await inscrever(t, { cookie: ana }, 2)
  await gerar(t, ana)
  return t
}

const cobrancaDaAna = async (t: Torneio) => (await detalhe(t, ana)).cobranca!

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/configuracoes', {
    nomeClube: 'Clube Teste', valorMensalidade: '0', valorAluguelPadrao: '0', diaVencimento: '10',
    regraCobrancaAluguel: 'ABERTO_NO_PRIMEIRO_DIA',
    chavePix: 'clube@exemplo.org', titularPix: 'Clube de Kendo', cidadePix: 'Sao Paulo',
  }, { cookie: diretoria })

  await enviar('/api/modalidades', { nome: 'Kendo Pagamento', kyuInicial: '6', ativa: 'on' }, { cookie: diretoria })
  const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
  modalidade = dados.find(m => m.nome === 'Kendo Pagamento')!.id

  const criar = async (nome: string, semente: number, comAcesso: boolean) => {
    const criada = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: nome, documento: gerarCpf(semente), email: `q${semente}@teste.local`,
    }), { cookie: diretoria })
    const id = criada.destino.split('/').pop()!
    if (!comAcesso) return { id, cookie: '' }

    const acesso = await enviar(`/api/praticantes/${id}/acesso`, {}, { cookie: diretoria })
    const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
    await enviar('/api/auth/redefinir-senha', { token, senha: `senha ${semente}`, confirmacao: `senha ${semente}` })
    return { id, cookie: await entrar(`q${semente}@teste.local`, `senha ${semente}`) }
  }

  const a = await criar('Ana Pagadora', 9101, true)
  ids.ana = a.id
  ana = a.cookie
  const d = await criar('Dani Intrusa', 9102, true)
  dani = d.cookie
  ids.beto = (await criar('Beto Sem Acesso', 9103, false)).id
}, 180_000)

describe('declarar o pagamento', () => {
  it('exige o Pix gerado, e o comprovante em imagem de até 2 MB', async () => {
    const t = await torneio('Seminário Do Comprovante Exigido')
    await inscrever(t, { cookie: ana }, 2)

    expect((await declarar(t, ana)).problemas[0]).toContain('Gere o Pix')

    await gerar(t, ana)
    const semArquivo = await enviarArquivo('/api/eventos/comprovante', { eventoId: t.eventoId }, undefined, { cookie: ana })
    expect(semArquivo.problemas[0]).toContain('Escolha um arquivo')

    // Um arquivo de texto com nome e tipo de imagem: o que vale são os bytes.
    const disfarcado = new TextEncoder().encode('<svg onload="alert(1)"></svg>') as Uint8Array<ArrayBuffer>
    expect((await declarar(t, ana, disfarcado)).problemas[0]).toContain('JPEG, PNG ou WebP')

    expect((await declarar(t, ana, png(2 * 1024 * 1024 + 1))).problemas[0]).toContain('no máximo 2 MB')

    expect((await cobrancaDaAna(t)).situacao).toBe('GERADA')
  })

  it('comprovante de um Pix desatualizado não vale', async () => {
    const t = await inscritaComPix('Seminário Do Comprovante Velho')
    await inscrever(t, { cookie: ana }, 3)

    expect((await declarar(t, ana)).problemas[0]).toContain('inscrição mudou')
  })

  it('com o Pix em dia, vai para análise e a inscrição trava para a pessoa', async () => {
    const t = await inscritaComPix('Seminário Que Trava')

    expect((await declarar(t, ana)).ok).toBe(true)

    const dados = await detalhe(t, ana)
    expect(dados.cobranca).toMatchObject({ situacao: 'EM_ANALISE', temComprovante: true, pix: null })
    expect(dados.inscricaoTravada).toBe(true)
    expect(dados.podeInscrever).toBe(false)

    expect((await inscrever(t, { cookie: ana }, 5)).problemas[0]).toContain('em análise')
    expect((await enviar('/api/eventos/inscricao', { eventoId: t.eventoId }, { cookie: ana })).problemas[0])
      .toContain('em análise')
    expect((await gerar(t, ana)).problemas[0]).toContain('já foi declarado')
    expect((await declarar(t, ana)).problemas[0]).toContain('aguarda a conferência')

    // A diretoria continua podendo mudar, e a lista mostra que o Pix já não bate.
    expect((await inscrever(t, { cookie: diretoria, praticanteId: ids.ana }, 3)).ok).toBe(true)
    expect((await pagamentos(t)).linhas[0]!.cobranca).toMatchObject({ situacao: 'EM_ANALISE', atualizada: false })
  })

  it('só a pessoa declara: a diretoria dá a baixa', async () => {
    const t = await torneio('Seminário Do Declarante')
    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 1)
    await gerar(t, diretoria, { praticanteId: ids.beto! })

    // Sem praticante ligado à conta da diretoria, não há de quem declarar.
    expect((await declarar(t, diretoria)).ok).toBe(false)
  })
})

describe('ver o comprovante', () => {
  it('só quem enviou e a diretoria veem, sem cache', async () => {
    const t = await inscritaComPix('Seminário Do Comprovante Privado')
    const bytes = png(300)
    await declarar(t, ana, bytes)
    const { id } = (await cobrancaDaAna(t))

    const dela = await fetch(`${ENDERECO}/api/eventos/comprovante/${id}`, { headers: { cookie: ana } })
    expect(dela.status).toBe(200)
    expect(dela.headers.get('content-type')).toBe('image/png')
    expect(dela.headers.get('x-content-type-options')).toBe('nosniff')
    expect(dela.headers.get('cache-control')).toBe('private, no-store')
    expect(new Uint8Array(await dela.arrayBuffer())).toEqual(bytes)

    const daDiretoria = await fetch(`${ENDERECO}/api/eventos/comprovante/${id}`, { headers: { cookie: diretoria } })
    expect(daDiretoria.status).toBe(200)

    const alheia = await fetch(`${ENDERECO}/api/eventos/comprovante/${id}`, { headers: { cookie: dani } })
    expect(alheia.status).toBe(404)

    const anonima = await fetch(`${ENDERECO}/api/eventos/comprovante/${id}`)
    expect(anonima.status).not.toBe(200)
  })
})

describe('análise da diretoria', () => {
  it('confirmar dá a baixa e apaga o comprovante', async () => {
    const t = await inscritaComPix('Seminário Do Pagamento Confirmado')
    const antes = arquivosNoDisco()
    await declarar(t, ana)
    const [arquivo] = arquivosNoDisco().filter(a => !antes.includes(a))
    expect(arquivo).toBeDefined()

    const { id } = await cobrancaDaAna(t)
    expect((await decidir(id, 'aceitar')).ok).toBe(true)

    const dados = await detalhe(t, ana)
    expect(dados.cobranca).toMatchObject({ situacao: 'PAGA', temComprovante: false })
    expect(dados.cobranca!.pagaEm).not.toBeNull()
    expect(arquivosNoDisco()).not.toContain(arquivo)

    const doComprovante = await fetch(`${ENDERECO}/api/eventos/comprovante/${id}`, { headers: { cookie: diretoria } })
    expect(doComprovante.status).toBe(404)

    expect((await inscrever(t, { cookie: ana }, 1)).problemas[0]).toContain('já foi confirmado')

    const lista = await ler<InscritosDoEvento>(`/api/eventos/${t.eventoId}/inscritos`, diretoria)
    expect(lista.dados.inscritos[0]!.cobranca).toMatchObject({ situacao: 'PAGA', atualizada: true })
  })

  it('recusar pede o motivo, devolve a cobrança e a pessoa envia outro comprovante', async () => {
    const t = await inscritaComPix('Seminário Do Comprovante Recusado')
    const antes = arquivosNoDisco()
    await declarar(t, ana)
    const [arquivo] = arquivosNoDisco().filter(a => !antes.includes(a))
    const { id } = await cobrancaDaAna(t)

    expect((await decidir(id, 'recusar')).problemas[0]).toContain('por que')

    expect((await decidir(id, 'recusar', { motivoRecusa: 'O valor do comprovante é R$ 20,00.' })).ok).toBe(true)
    const recusada = await detalhe(t, ana)
    expect(recusada.cobranca).toMatchObject({
      situacao: 'GERADA', motivoRecusa: 'O valor do comprovante é R$ 20,00.', temComprovante: false,
    })
    expect(recusada.cobranca!.pix).not.toBeNull()
    expect(recusada.inscricaoTravada).toBe(false)
    expect(arquivosNoDisco()).not.toContain(arquivo)

    // Enviar outro limpa o motivo e recomeça a análise.
    expect((await declarar(t, ana)).ok).toBe(true)
    const nova = await detalhe(t, ana)
    expect(nova.cobranca).toMatchObject({ situacao: 'EM_ANALISE', motivoRecusa: null, temComprovante: true })
  })

  it('confirmar ou recusar só vale para comprovante em análise', async () => {
    const t = await inscritaComPix('Seminário Sem Comprovante Para Conferir')
    const { id } = await cobrancaDaAna(t)

    expect((await decidir(id, 'aceitar')).problemas[0]).toContain('Não há comprovante')
    expect((await decidir(id, 'recusar', { motivoRecusa: 'x' })).problemas[0]).toContain('Não há comprovante')
    expect((await decidir(id, 'apagar')).problemas[0]).toContain('inválida')
  })

  it('dar baixa registra um pagamento feito fora do sistema, só sobre um Pix em dia', async () => {
    const t = await torneio('Seminário Da Baixa Direta')
    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 1)
    await gerar(t, diretoria, { praticanteId: ids.beto! })
    const betoId = (await pagamentos(t)).linhas[0]!.cobranca!.id

    // Com o Pix desatualizado, não.
    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 2)
    expect((await decidir(betoId, 'baixar')).problemas[0]).toContain('Gere um novo')

    await gerar(t, diretoria, { praticanteId: ids.beto! })
    expect((await decidir(betoId, 'baixar')).ok).toBe(true)

    const linha = (await pagamentos(t)).linhas[0]!
    expect(linha.cobranca).toMatchObject({ situacao: 'PAGA' })
    expect(linha.cobranca!.observacao).toContain('Baixa direta, sem comprovante')

    expect((await decidir(betoId, 'baixar')).problemas[0]).toContain('já foi confirmado')
  })

  it('não dá baixa sobre comprovante que aguarda conferência', async () => {
    const t = await inscritaComPix('Seminário Da Baixa Sobre Comprovante')
    await declarar(t, ana)
    const { id } = await cobrancaDaAna(t)
    expect((await decidir(id, 'baixar')).problemas[0]).toContain('aceite ou recuse')
  })

  it('o estorno desfaz a baixa sem apagar o histórico', async () => {
    const t = await inscritaComPix('Seminário Do Estorno')
    await declarar(t, ana)
    const { id } = await cobrancaDaAna(t)
    await decidir(id, 'aceitar')

    expect((await decidir(id, 'estornar')).ok).toBe(true)

    const dados = await detalhe(t, ana)
    expect(dados.cobranca).toMatchObject({ situacao: 'GERADA', pagaEm: null })
    expect(dados.inscricaoTravada).toBe(false)
    expect((await pagamentos(t)).linhas[0]!.cobranca!.observacao).toContain('Baixa estornada')

    expect((await decidir(id, 'estornar')).problemas[0]).toContain('confirmado')
  })

  it('praticante não analisa pagamento', async () => {
    const t = await inscritaComPix('Seminário Da Análise Protegida')
    const { id } = await cobrancaDaAna(t)

    const resposta = await enviar('/api/eventos/pagamento', { cobrancaId: id, acao: 'baixar' }, { cookie: ana })
    expect(resposta.status).toBe(403)

    const leitura = await fetch(`${ENDERECO}/api/eventos/${t.eventoId}/pagamentos`, { headers: { cookie: ana } })
    expect(leitura.status).toBe(403)
  })
})

describe('arquivo em disco', () => {
  it('a diretoria tira a inscrição com comprovante em análise e o arquivo vai junto', async () => {
    const t = await inscritaComPix('Seminário Que Perde O Comprovante')
    const antes = arquivosNoDisco()
    await declarar(t, ana)
    const [arquivo] = arquivosNoDisco().filter(a => !antes.includes(a))
    expect(arquivo).toBeDefined()

    const desistencia = await enviar('/api/eventos/inscricao', { eventoId: t.eventoId, praticanteId: ids.ana! },
      { cookie: diretoria })
    expect(desistencia.ok).toBe(true)

    expect(arquivosNoDisco()).not.toContain(arquivo)
  })
})

describe('tela de pagamentos', () => {
  async function html(caminho: string, cookie: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: { cookie } })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('põe o que há para conferir primeiro e resume o que foi confirmado', async () => {
    const t = await torneio('Seminário Da Tela De Pagamentos')
    await inscrever(t, { cookie: ana }, 2)
    await gerar(t, ana)
    await declarar(t, ana)
    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 1)
    await gerar(t, diretoria, { praticanteId: ids.beto! })
    const betoId = (await pagamentos(t)).linhas.find(l => l.nome.startsWith('Beto'))!.cobranca!.id
    await decidir(betoId, 'baixar')

    const dados = await pagamentos(t)
    expect(dados.linhas.map(l => l.nome)).toEqual(['Ana Pagadora', 'Beto Sem Acesso'])
    expect(dados.resumo.porEstado).toMatchObject({ EM_ANALISE: 1, PAGA: 1 })
    // Beto: R$ 30 + 1 obento de R$ 20.
    expect(dados.resumo.confirmado).toBe(50)
    expect(dados.resumo.esperado).toBe(120)
  })

  it('mostra as ações de cada situação, com os nomes que o servidor lê', async () => {
    const t = await inscritaComPix('Seminário Da Tela Das Ações')

    const emDia = await html(`/eventos/${t.eventoId}/pagamentos`, diretoria)
    expect(emDia.status).toBe(200)
    expect(emDia.texto).toContain('action="/api/eventos/pagamento"')
    expect(emDia.texto).toContain('Dar baixa')

    await declarar(t, ana)
    const emAnalise = await html(`/eventos/${t.eventoId}/pagamentos`, diretoria)
    expect(emAnalise.texto).toContain('Ver o comprovante')
    expect(emAnalise.texto).toContain('Confirmar pagamento')
    expect(emAnalise.texto).toContain('name="motivoRecusa"')

    const { id } = await cobrancaDaAna(t)
    await decidir(id, 'aceitar')
    expect((await html(`/eventos/${t.eventoId}/pagamentos`, diretoria)).texto).toContain('Estornar baixa')
  })

  it('a inscrição mostra o formulário do comprovante, e depois o andamento', async () => {
    const t = await inscritaComPix('Seminário Da Tela Da Inscrição')

    const antes = await html(`/agenda/${t.slug}`, ana)
    expect(antes.texto).toContain('enctype="multipart/form-data"')
    expect(antes.texto).toContain('name="comprovante"')

    await declarar(t, ana)
    const durante = await html(`/agenda/${t.slug}`, ana)
    expect(durante.texto).toContain('Comprovante enviado')
    expect(durante.texto).toContain('Ver o comprovante enviado')
    expect(durante.texto).not.toContain('name="comprovante"')

    const { id } = await cobrancaDaAna(t)
    await decidir(id, 'aceitar')
    expect((await html(`/agenda/${t.slug}`, ana)).texto).toContain('confirmado')
  })

  it('a tela de pagamentos só abre para a diretoria', async () => {
    const t = await torneio('Seminário Da Tela Protegida')
    const resposta = await fetch(`${ENDERECO}/eventos/${t.eventoId}/pagamentos`, {
      headers: { cookie: ana }, redirect: 'manual',
    })
    expect(resposta.status).not.toBe(200)
  })
})
