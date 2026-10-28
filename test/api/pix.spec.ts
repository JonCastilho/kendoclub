import { beforeAll, describe, expect, it } from 'vitest'
import type { EventoDetalhado, InscritosDoEvento } from '../../shared/evento'
import { crc16 } from '../../shared/pix'
import { ENDERECO, comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * Pix da inscrição (etapa 7.4b-1): o valor e os itens vêm da inscrição gravada,
 * o código segue o padrão do Pix e mudar a inscrição o deixa desatualizado.
 *
 * Dois cadastros:
 * - Ana, com acesso ao sistema: seminário de R$ 30 e 2 obentos de R$ 20 (R$ 70);
 * - Beto, sem acesso: só se inscreve num seminário gratuito.
 */

let diretoria = ''
let ana = ''
let modalidade = ''
const ids: Record<string, string> = {}

const DIA = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10)
const prazo = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)

const CHAVE = 'clube@exemplo.org'

function configurarPix(campos: { chavePix: string, titularPix: string, cidadePix: string }) {
  return enviar('/api/configuracoes', {
    nomeClube: 'Clube Teste', valorMensalidade: '0', valorAluguelPadrao: '0', diaVencimento: '10',
    regraCobrancaAluguel: 'ABERTO_NO_PRIMEIRO_DIA', ...campos,
  }, { cookie: diretoria })
}

interface Torneio {
  eventoId: string
  slug: string
  seminario: string
}

/** Evento publicado com um seminário de `valor` e obento de R$ 20. */
async function torneio(titulo: string, valor: string): Promise<Torneio> {
  const criado = await enviar('/api/eventos', {
    titulo, descricao: 'Seminário.', prazoInscricao: prazo, visibilidade: 'PUBLICA',
  }, { cookie: diretoria })
  if (!criado.ok) throw new Error(`${titulo}: ${criado.problemas.join('; ')}`)
  const eventoId = criado.destino.split('/').pop()!

  await enviar('/api/eventos/subeventos', {
    eventoId, tipo: 'SEMINARIO', modalidadeId: modalidade, local: 'Dojo', dia_1: DIA, valor,
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

const detalhe = async (t: Torneio, cookie: string, query = '') =>
  (await ler<EventoDetalhado>(`/api/eventos/${t.slug}${query}`, cookie)).dados

/** Lê o BR Code em campos, sem descer nos compostos. */
function campos(payload: string): Record<string, string> {
  const lidos: Record<string, string> = {}
  let posicao = 0
  while (posicao < payload.length) {
    const tamanho = Number(payload.slice(posicao + 2, posicao + 4))
    lidos[payload.slice(posicao, posicao + 2)] = payload.slice(posicao + 4, posicao + 4 + tamanho)
    posicao += 4 + tamanho
  }
  return lidos
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/modalidades', { nome: 'Kendo Pix', kyuInicial: '6', ativa: 'on' }, { cookie: diretoria })
  const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
  modalidade = dados.find(m => m.nome === 'Kendo Pix')!.id

  const criar = async (nome: string, semente: number) => {
    const criada = await enviar('/api/praticantes', dadosDePraticante({
      nomeCompleto: nome, documento: gerarCpf(semente), email: `p${semente}@teste.local`,
    }), { cookie: diretoria })
    return criada.destino.split('/').pop()!
  }
  ids.ana = await criar('Ana Maria Pagadora', 9001)
  ids.beto = await criar('Beto Gratuito', 9002)

  const acesso = await enviar(`/api/praticantes/${ids.ana}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', { token, senha: 'senha da ana', confirmacao: 'senha da ana' })
  ana = await entrar('p9001@teste.local', 'senha da ana')
}, 180_000)

describe('configuração do Pix', () => {
  it('sem chave, titular e cidade, não gera, e a diretoria vê o que falta', async () => {
    await configurarPix({ chavePix: '', titularPix: '', cidadePix: '' })
    const t = await torneio('Seminário Sem Pix Configurado', '30,00')
    await inscrever(t, { cookie: ana }, 2)

    const doKenshi = await gerar(t, ana)
    expect(doKenshi.problemas).toEqual(['O clube ainda não configurou o Pix. Avise a diretoria.'])

    const daDiretoria = await gerar(t, diretoria, { praticanteId: ids.ana! })
    expect(daDiretoria.problemas.join(' ')).toContain('chave Pix')
    expect(daDiretoria.problemas.join(' ')).toContain('cidade')

    expect((await detalhe(t, ana)).pixDisponivel).toBe(false)
  })

  it('a cidade é gravada em Configurações, e a tela traz o campo', async () => {
    await configurarPix({ chavePix: CHAVE, titularPix: 'Clube de Kendo Fukuhaku', cidadePix: 'São Paulo' })

    const { dados } = await ler<{ cidadePix: string }>('/api/configuracoes', diretoria)
    expect(dados.cidadePix).toBe('São Paulo')

    const tela = await fetch(`${ENDERECO}/configuracoes`, { headers: { cookie: diretoria } })
    expect(await tela.text()).toContain('name="cidadePix"')
  })
})

describe('gerar o Pix', () => {
  beforeAll(async () => {
    await configurarPix({ chavePix: CHAVE, titularPix: 'Clube de Kendo Fukuhaku', cidadePix: 'São Paulo' })
  })

  it('traz o valor e os itens da inscrição, no padrão do Pix', async () => {
    const t = await torneio('Seminário Do Pix', '30,00')
    await inscrever(t, { cookie: ana }, 2)

    expect((await gerar(t, ana)).ok).toBe(true)

    const { cobranca, pixDisponivel } = await detalhe(t, ana)
    expect(pixDisponivel).toBe(true)
    expect(cobranca).toMatchObject({ valor: 70, itens: ['seminário', 'obento (2)'], atualizada: true })

    const codigo = cobranca!.pix!.copiaECola
    const lidos = campos(codigo)
    expect(lidos['54']).toBe('70.00')
    expect(lidos['59']).toBe('CLUBE DE KENDO FUKUHAKU')
    expect(lidos['60']).toBe('SAO PAULO')
    const conta = campos(lidos['26']!)
    expect(conta['01']).toBe(CHAVE)
    // Quem paga e o que paga, sem acento; o nome do meio cede para caber.
    expect(conta['02']).toContain('Ana Pagadora')
    expect(conta['02']).toContain('seminario')
    expect(conta['02']).toContain('obento (2)')
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)))

    expect(cobranca!.pix!.qrCode.startsWith('data:image/png;base64,')).toBe(true)
    expect(cobranca!.pix!.mensagem).toBe(conta['02'])
  })

  it('o valor vem da inscrição gravada, e nunca do formulário', async () => {
    const t = await torneio('Seminário Do Valor Forjado', '30,00')
    await inscrever(t, { cookie: ana }, 0)

    await gerar(t, ana, { valor: '1,00', total: '1' })
    expect((await detalhe(t, ana)).cobranca?.valor).toBe(30)
  })

  it('mudar a inscrição deixa o Pix desatualizado, e gerar de novo o atualiza', async () => {
    const t = await torneio('Seminário Do Pix Desatualizado', '30,00')
    await inscrever(t, { cookie: ana }, 2)
    await gerar(t, ana)

    await inscrever(t, { cookie: ana }, 3)
    const velho = await detalhe(t, ana)
    expect(velho.cobranca).toMatchObject({ valor: 70, atualizada: false, pix: null })

    const lista = await ler<InscritosDoEvento>(`/api/eventos/${t.eventoId}/inscritos`, diretoria)
    expect(lista.dados.inscritos[0]!.cobranca).toEqual({ valor: 70, atualizada: false })

    await gerar(t, ana)
    const novo = await detalhe(t, ana)
    expect(novo.cobranca).toMatchObject({ valor: 90, itens: ['seminário', 'obento (3)'], atualizada: true })
    expect(novo.cobranca!.pix).not.toBeNull()
  })

  it('salvar a inscrição sem mudar o total nem os itens mantém o Pix', async () => {
    const t = await torneio('Seminário Do Pix Mantido', '30,00')
    await inscrever(t, { cookie: ana }, 2)
    await gerar(t, ana)

    await inscrever(t, { cookie: ana }, 2)
    expect((await detalhe(t, ana)).cobranca?.atualizada).toBe(true)
  })

  it('quem não se inscreveu, ou não tem nada a pagar, não gera', async () => {
    const t = await torneio('Seminário Gratuito', '0')

    expect((await gerar(t, ana)).problemas[0]).toContain('Salve a inscrição')

    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 0)
    const gratis = await gerar(t, diretoria, { praticanteId: ids.beto! })
    expect(gratis.problemas[0]).toContain('nada a pagar')
  })

  it('só a diretoria gera o Pix de outra pessoa', async () => {
    const t = await torneio('Seminário Do Pix Alheio', '30,00')
    await inscrever(t, { cookie: diretoria, praticanteId: ids.beto }, 1)

    const intrusa = await enviar('/api/eventos/pix', { eventoId: t.eventoId, praticanteId: ids.beto! }, { cookie: ana })
    expect(intrusa.status).toBe(403)

    expect((await gerar(t, diretoria, { praticanteId: ids.beto! })).ok).toBe(true)
    const doBeto = await detalhe(t, diretoria, `?praticante=${ids.beto}`)
    expect(doBeto.cobranca).toMatchObject({ valor: 50, itens: ['seminário', 'obento (1)'] })
    expect(doBeto.cobranca!.pix!.mensagem).toContain('Beto Gratuito')
  })
})

describe('telas', () => {
  async function html(caminho: string, cookie: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: { cookie } })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('oferece Gerar PIX e, depois de gerado, mostra o QR code e o código para copiar', async () => {
    const t = await torneio('Seminário Na Tela Do Pix', '30,00')
    await inscrever(t, { cookie: ana }, 1)

    const antes = await html(`/agenda/${t.slug}`, ana)
    expect(antes.texto).toContain('action="/api/eventos/pix"')
    expect(antes.texto).toContain('Gerar PIX')
    expect(antes.texto).not.toContain('pix-copia-e-cola')

    await gerar(t, ana)
    const depois = await html(`/agenda/${t.slug}`, ana)
    expect(depois.texto).toContain('id="pix-copia-e-cola"')
    expect(depois.texto).toContain('data:image/png;base64,')
    expect(depois.texto).not.toContain('Gerar PIX')
  })

  it('a lista de inscritos mostra se o Pix foi gerado', async () => {
    const t = await torneio('Seminário Dos Inscritos Com Pix', '30,00')
    await inscrever(t, { cookie: ana }, 1)

    expect((await html(`/eventos/${t.eventoId}/inscritos`, diretoria)).texto).toContain('sem Pix')

    await gerar(t, ana)
    expect((await html(`/eventos/${t.eventoId}/inscritos`, diretoria)).texto).toContain('gerado')
  })
})
