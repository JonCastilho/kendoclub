import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { hojeNoFuso } from '../../shared/evento'
import {
  comoDiretoria, consultarBanco, dadosDePraticante, entrar, enviar, gerarCpf, ler,
} from './ajudantes'

/**
 * Lembrete de mensalidade em atraso e o dia de pagamento do praticante.
 *
 * As mensalidades são montadas direto no banco, com vencimento relativo a hoje:
 * pela API só se gera a cobrança do mês, e não há como dizer "venceu há 20
 * dias". O servidor de teste não tem SMTP, então o que se prova aqui é quem
 * entra no plano, o que fica de fora e que um envio que não sai não deixa
 * rastro. O caminho do e-mail que sai de verdade foi conferido à mão contra um
 * servidor SMTP de mentira, e mora em PLANO.md.
 */

const hoje = hojeNoFuso('America/Sao_Paulo')

/** O dia que fica `n` dias antes de hoje, no formato AAAA-MM-DD. */
function diasAtras(n: number): string {
  const data = new Date(`${hoje}T00:00:00.000Z`)
  data.setUTCDate(data.getUTCDate() - n)
  return data.toISOString().slice(0, 10)
}

const competenciaDe = (dia: string) => dia.slice(0, 7)

interface ItemDoPlano {
  mensalidadeId: string
  competencia: string
  valor: number
  referencia: string
  atraso: number
  marco: number
}

interface LembreteDoPlano {
  praticanteId: string
  nome: string
  email: string
  diaDePagamento: number | null
  temAcesso: boolean
  itens: ItemDoPlano[]
}

let diretoria = ''
const ids: Record<string, string> = {}
const mensalidades: Record<string, string> = {}
const cookies: Record<string, string> = {}

async function criar(chave: string, nome: string, semente: number, extra: Record<string, string> = {}) {
  const resposta = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: nome,
    documento: gerarCpf(semente),
    email: `l${semente}@teste.local`,
    // Filiado só depois de março, para a geração de março (usada num teste) não
    // criar cobrança extra para quem este arquivo monta à mão.
    filiacaoInicioEm: '2026-06-01',
    ...extra,
  }), { cookie: diretoria })

  if (!resposta.ok) throw new Error(`${nome}: ${resposta.problemas.join('; ')}`)
  ids[chave] = resposta.destino.split('/').pop()!
}

async function darAcesso(chave: string, semente: number) {
  const acesso = await enviar(`/api/praticantes/${ids[chave]}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', { token, senha: `senha ${semente}`, confirmacao: `senha ${semente}` })
  cookies[chave] = await entrar(`l${semente}@teste.local`, `senha ${semente}`)
}

async function inserirMensalidade(
  chave: string,
  praticante: string,
  competencia: string,
  vencimento: string,
  opcoes: { valor?: string, situacao?: string } = {},
) {
  const id = randomUUID()
  await consultarBanco(
    `insert into "Mensalidade"
       (id, competencia, "valorTotal", vencimento, situacao, "praticanteId", "criadoEm", "atualizadoEm")
     values ($1, $2, $3, $4::timestamp, $5::"SituacaoMensalidade", $6, now(), now())`,
    [id, competencia, opcoes.valor ?? '150', vencimento, opcoes.situacao ?? 'ABERTA', ids[praticante]],
  )
  mensalidades[chave] = id
}

async function plano() {
  const { dados } = await ler<{ lembretes: LembreteDoPlano[], pessoas: number }>(
    '/api/mensalidades/lembretes', diretoria)
  return dados
}

async function doPlano(chave: string) {
  return (await plano()).lembretes.find(l => l.praticanteId === ids[chave])
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/configuracoes', {
    nomeClube: 'Clube de Teste',
    valorMensalidade: '150',
    diaVencimento: '10',
    regraCobrancaAluguel: 'ABERTO_NO_PRIMEIRO_DIA',
  }, { cookie: diretoria })

  const diaCombinado = String(Number(diasAtras(20).slice(8)))

  await criar('ana', 'Lembrete Ana', 8101, { diaDePagamento: diaCombinado })
  await criar('bia', 'Lembrete Bia', 8102)
  await criar('caio', 'Lembrete Caio', 8103)
  await criar('dani', 'Lembrete Dani', 8104)
  await criar('edu', 'Lembrete Edu', 8105)
  await criar('fabi', 'Lembrete Fabi', 8106)
  await criar('gabi', 'Lembrete Gabi', 8107)
  await criar('hugo', 'Lembrete Hugo', 8108)
  await criar('iara', 'Lembrete Iara', 8109)

  await darAcesso('ana', 8101)
  await darAcesso('fabi', 8106)

  // Ana combinou pagar no dia de hoje-20; o vencimento do clube é o dia 1 do
  // mês, bem antes: quem decide é o dia dela.
  await inserirMensalidade('ana', 'ana', competenciaDe(diasAtras(20)), `${competenciaDe(diasAtras(20))}-01`)
  await inserirMensalidade('bia', 'bia', competenciaDe(diasAtras(35)), diasAtras(35))
  await inserirMensalidade('caio', 'caio', competenciaDe(diasAtras(10)), diasAtras(10))
  await inserirMensalidade('dani', 'dani', competenciaDe(diasAtras(50)), diasAtras(50))
  await inserirMensalidade('edu', 'edu', competenciaDe(diasAtras(20)), diasAtras(20), { situacao: 'PAGA' })
  await inserirMensalidade('fabi', 'fabi', competenciaDe(diasAtras(20)), diasAtras(20))
  await inserirMensalidade('gabi1', 'gabi', '2026-01', diasAtras(20))
  await inserirMensalidade('gabi2', 'gabi', '2026-02', diasAtras(35))
  await inserirMensalidade('hugo', 'hugo', competenciaDe(diasAtras(20)), diasAtras(20))
  await inserirMensalidade('iara', 'iara', competenciaDe(diasAtras(35)), diasAtras(35))

  // Hugo já recebeu o de 15 dias. Iara também, mas já está na janela dos 30.
  for (const chave of ['hugo', 'iara']) {
    await consultarBanco(
      `insert into "LembreteDeMensalidade" (id, dias, para, "enviadoEm", "mensalidadeId")
       values ($1, 15, 'antigo@teste.local', now(), $2)`,
      [randomUUID(), mensalidades[chave]],
    )
  }
}, 240_000)

describe('quem entra no plano de lembretes', () => {
  it('lembra quem está entre 15 e 29 dias de atraso, pelo marco de 15', async () => {
    const lembrete = await doPlano('ana')
    expect(lembrete?.itens).toHaveLength(1)
    expect(lembrete?.itens[0]).toMatchObject({ marco: 15, atraso: 20, valor: 150 })
  })

  it('conta do dia combinado, e não do vencimento do clube', async () => {
    const item = (await doPlano('ana'))!.itens[0]!
    expect(item.referencia).toBe(diasAtras(20))
  })

  it('entre 30 e 44 dias, o marco é o de 30', async () => {
    const item = (await doPlano('bia'))!.itens[0]!
    expect(item).toMatchObject({ marco: 30, atraso: 35 })
  })

  it('não lembra quem ainda não chegou aos 15 dias', async () => {
    expect(await doPlano('caio')).toBeUndefined()
  })

  it('não lembra quem passou da janela do último marco', async () => {
    expect(await doPlano('dani')).toBeUndefined()
  })

  it('não lembra cobrança já paga', async () => {
    expect(await doPlano('edu')).toBeUndefined()
  })

  it('junta as mensalidades de uma pessoa num só e-mail, na ordem das competências', async () => {
    const lembrete = await doPlano('gabi')
    expect(lembrete?.itens.map(i => [i.competencia, i.marco])).toEqual([['2026-01', 15], ['2026-02', 30]])
  })

  it('não repete o marco que já foi enviado', async () => {
    expect(await doPlano('hugo')).toBeUndefined()
  })

  it('depois do de 15, o de 30 ainda sai', async () => {
    const item = (await doPlano('iara'))!.itens[0]!
    expect(item.marco).toBe(30)
  })

  it('manda para o e-mail de contato e diz se a pessoa tem acesso ao sistema', async () => {
    const ana = await doPlano('ana')
    const bia = await doPlano('bia')

    expect(ana).toMatchObject({ email: 'l8101@teste.local', temAcesso: true })
    expect(bia).toMatchObject({ email: 'l8102@teste.local', temAcesso: false })
  })
})

describe('aviso de pagamento e lembrete', () => {
  it('quem avisou que pagou e espera conferência não recebe', async () => {
    expect(await doPlano('fabi')).toBeDefined()

    const resposta = await enviar(`/api/mensalidades/${mensalidades.fabi}/declaracao`,
      { pagoEm: hoje }, { cookie: cookies.fabi })
    expect(resposta.ok).toBe(true)

    expect(await doPlano('fabi')).toBeUndefined()
  })

  it('se a diretoria recusa o aviso, a pessoa volta ao plano', async () => {
    const resposta = await enviar(`/api/mensalidades/${mensalidades.fabi}/declaracao`,
      { acao: 'recusar', motivoRecusa: 'Não achei no extrato' }, { cookie: diretoria })
    expect(resposta.ok).toBe(true)

    expect(await doPlano('fabi')).toBeDefined()
  })
})

describe('envio sem servidor de e-mail', () => {
  it('não envia, diz quantos ficaram sem aviso e não deixa rastro de envio', async () => {
    const antes = await plano()

    const resposta = await enviar('/api/mensalidades/lembretes', {}, { cookie: diretoria })
    expect(resposta.ok).toBe(true)

    const resumo = new URLSearchParams(resposta.destino.split('?')[1])
    expect(resumo.get('lembretesPessoas')).toBe('0')
    expect(Number(resumo.get('lembretesSemServidor'))).toBeGreaterThanOrEqual(antes.lembretes.length)
    expect(resumo.get('lembretesFalhas')).toBe('0')

    // A reserva é desfeita: nada consta como enviado, e quem estava no plano
    // continua nele para a próxima tentativa.
    const reservas = await consultarBanco<{ total: string }>(
      `select count(*)::text as total from "LembreteDeMensalidade" where "mensalidadeId" = any($1)`,
      [[mensalidades.ana, mensalidades.bia, mensalidades.gabi1, mensalidades.gabi2]],
    )
    expect(reservas[0]!.total).toBe('0')
    expect(await doPlano('ana')).toBeDefined()
    expect((await plano()).lembretes.length).toBe(antes.lembretes.length)
  })
})

describe('dia de pagamento no cadastro', () => {
  it('fica gravado com o que a diretoria escolheu', async () => {
    const { dados } = await ler<{ diaDePagamento: number | null }>(`/api/praticantes/${ids.ana}`, diretoria)
    expect(dados.diaDePagamento).toBe(Number(diasAtras(20).slice(8)))
  })

  it('vazio quer dizer o dia do clube', async () => {
    const { dados } = await ler<{ diaDePagamento: number | null }>(`/api/praticantes/${ids.bia}`, diretoria)
    expect(dados.diaDePagamento).toBeNull()
  })

  it.each(['0', '32', '-1', 'dez', '1.5'])('recusa o dia %s', async (dia) => {
    const resposta = await enviar('/api/praticantes', dadosDePraticante({
      documento: gerarCpf(8111), email: 'l8111@teste.local', diaDePagamento: dia,
    }), { cookie: diretoria })

    expect(resposta.ok).toBe(false)
    expect(resposta.problemas.join(' ')).toContain('1 a 31')
  })

  it('a diretoria troca o dia, e esvaziar volta ao dia do clube', async () => {
    const dados = (diaDePagamento: string) => dadosDePraticante({
      nomeCompleto: 'Lembrete Bia', documento: gerarCpf(8102), email: 'l8102@teste.local', diaDePagamento,
    })

    await enviar(`/api/praticantes/${ids.bia}`, dados('25'), { cookie: diretoria })
    let ficha = await ler<{ diaDePagamento: number | null }>(`/api/praticantes/${ids.bia}`, diretoria)
    expect(ficha.dados.diaDePagamento).toBe(25)

    await enviar(`/api/praticantes/${ids.bia}`, dados(''), { cookie: diretoria })
    ficha = await ler<{ diaDePagamento: number | null }>(`/api/praticantes/${ids.bia}`, diretoria)
    expect(ficha.dados.diaDePagamento).toBeNull()
  })

  it('o banco recusa dia fora de 1 a 31, mesmo sem passar pelo formulário', async () => {
    await expect(consultarBanco(
      `update "Praticante" set "diaDePagamento" = 40 where id = $1`, [ids.bia],
    )).rejects.toThrow()
  })

  it('o praticante não troca o próprio dia: é com a diretoria', async () => {
    const resposta = await enviar(`/api/praticantes/${ids.ana}`, dadosDePraticante({
      nomeCompleto: 'Lembrete Ana', documento: gerarCpf(8101), email: 'l8101@teste.local', diaDePagamento: '1',
    }), { cookie: cookies.ana })

    expect(resposta.status).toBe(403)
    const { dados } = await ler<{ diaDePagamento: number | null }>(`/api/praticantes/${ids.ana}`, diretoria)
    expect(dados.diaDePagamento).toBe(Number(diasAtras(20).slice(8)))
  })

  it('o dia combinado não muda o vencimento da cobrança gerada', async () => {
    await criar('marta', 'Lembrete Marta', 8110, { diaDePagamento: '25', filiacaoInicioEm: '2020-01-01' })
    await enviar('/api/mensalidades/gerar', { competencia: '2026-03' }, { cookie: diretoria })

    const { dados } = await ler<{ mensalidades: Array<{ vencimento: string, praticante: { id: string } }> }>(
      '/api/mensalidades?competencia=2026-03', diretoria)
    const marta = dados.mensalidades.find(m => m.praticante.id === ids.marta)

    expect(marta?.vencimento.slice(0, 10)).toBe('2026-03-10')
  })
})

describe('o que o praticante enxerga', () => {
  it('o dia dele e o dia do clube', async () => {
    const { dados } = await ler<{ diaDePagamento: number | null, diaDoClube: number }>(
      '/api/mensalidades/minhas', cookies.ana)

    expect(dados.diaDePagamento).toBe(Number(diasAtras(20).slice(8)))
    expect(dados.diaDoClube).toBe(10)
  })

  it('o que falta pagar soma as cobranças em aberto', async () => {
    const { dados } = await ler<{ aPagar: number, emAberto: number }>('/api/mensalidades/minhas', cookies.ana)
    expect(dados.aPagar).toBe(150)
    expect(dados.emAberto).toBe(150)
  })

  it('quem já avisou que pagou deixa de ter o que pagar, e a cobrança segue em aberto', async () => {
    await enviar(`/api/mensalidades/${mensalidades.fabi}/declaracao`, { pagoEm: hoje }, { cookie: cookies.fabi })

    const { dados } = await ler<{ aPagar: number, emAberto: number }>('/api/mensalidades/minhas', cookies.fabi)
    expect(dados.aPagar).toBe(0)
    expect(dados.emAberto).toBe(150)
  })

  it('a diretoria vê, em cada cobrança, os lembretes já enviados', async () => {
    const { dados } = await ler<{ mensalidades: Array<{ id: string, lembretes: Array<{ dias: number }> }> }>(
      `/api/mensalidades?competencia=${competenciaDe(diasAtras(20))}`, diretoria)

    const hugo = dados.mensalidades.find(m => m.id === mensalidades.hugo)
    expect(hugo?.lembretes.map(l => l.dias)).toEqual([15])
  })
})
