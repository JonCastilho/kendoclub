import { beforeAll, describe, expect, it } from 'vitest'
import type { EventoDetalhado, InscritosDoEvento } from '../../shared/evento'
import { ENDERECO, comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * Exame (etapa 7.3): graduações com banca, graduação pretendida tirada do
 * cadastro e aviso de carência.
 *
 * Cinco cadastros, cada um para um caso:
 * - Dan Recente: 1º dan há 100 dias — presta 2º dan e não cumpre a carência;
 * - Aspirante Antigo: 4º kyu há anos — vai direto ao 1º kyu;
 * - Sem Modalidade: nada no cadastro — mukyu, sem data para conferir;
 * - Mukyu Antigo: na modalidade desde 2010, sem graduação — cumpre pela data de início;
 * - Dan Sem Banca: 2º dan — presta 3º dan, que o exame não oferece.
 *
 * E quatro para o shogo, que é título registrado à parte da graduação:
 * - Sexto Dan: pode prestar 7º dan e Renshi — escolhe;
 * - Sexto Renshi: pode prestar 7º dan e Kyoshi — escolhe;
 * - Quinto Renshi: sem banca de 6º dan, presta Kyoshi — e não cumpre a
 *   carência, contada do Renshi;
 * - Quinto Dan: sem banca de 6º dan, presta Renshi — e não cumpre a carência.
 */

let diretoria = ''
let danRecente = ''
const ids: Record<string, string> = {}
let modalidade = ''

function daqui(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

async function praticante(nome: string, semente: number) {
  const criado = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: nome, documento: gerarCpf(semente), email: `x${semente}@teste.local`,
  }), { cookie: diretoria })
  if (!criado.ok) throw new Error(`${nome}: ${criado.problemas.join('; ')}`)
  return criado.destino.split('/').pop()!
}

function registrarShogo(id: string, shogo: string, obtidoEm: string) {
  return enviar(`/api/praticantes/${id}/shogos`, { modalidadeId: modalidade, shogo, obtidoEm }, { cookie: diretoria })
}

async function graduar(id: string, grau: string | null, graduadoEm: string, desde = '2010-01-01') {
  await enviar(`/api/praticantes/${id}/modalidades`, { modalidadeId: modalidade, desde }, { cookie: diretoria })
  if (grau) {
    await enviar(`/api/praticantes/${id}/graduacao`, { modalidadeId: modalidade, grau, graduadoEm },
      { cookie: diretoria })
  }
}

interface Exame {
  evento: EventoDetalhado
  subeventoId: string
}

function oferecer(subeventoId: string, grau: string, valor: string) {
  return enviar('/api/eventos/graduacoes', { subeventoId, grau, valor }, { cookie: diretoria })
}

async function exame(titulo: string, graduacoes: Array<[string, string]>): Promise<Exame> {
  const criado = await enviar('/api/eventos', {
    titulo, descricao: 'Exame de graduação.', prazoInscricao: daqui(10),
  }, { cookie: diretoria })
  const eventoId = criado.destino.split('/').pop()!

  await enviar('/api/eventos/subeventos', {
    eventoId, tipo: 'EXAME', modalidadeId: modalidade, local: 'Dojo central', dia_1: daqui(20),
  }, { cookie: diretoria })

  let { dados: evento } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)
  const subeventoId = evento.subeventos[0]!.id

  for (const [grau, valor] of graduacoes) {
    const resposta = await oferecer(subeventoId, grau, valor)
    if (!resposta.ok) throw new Error(`${grau}: ${resposta.problemas.join('; ')}`)
  }

  await enviar('/api/eventos/publicar', { id: eventoId }, { cookie: diretoria })
  evento = (await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)).dados
  return { evento, subeventoId }
}

const BANCAS: Array<[string, string]> = [['KYU_1', '80'], ['DAN_1', '150'], ['DAN_2', '200']]

function inscrever(e: Exame, cookie: string, praticanteId?: string) {
  return enviar('/api/eventos/inscricao', {
    eventoId: e.evento.id,
    [`subevento_${e.subeventoId}`]: 'on',
    ...(praticanteId ? { praticanteId } : {}),
  }, { cookie })
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/modalidades', { nome: 'Kendo Exame', kyuInicial: '6', ativa: 'on' }, { cookie: diretoria })
  const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
  modalidade = dados.find(m => m.nome === 'Kendo Exame')!.id

  // Carência: 12 meses para 1º kyu, 24 para 2º dan, 60 para Renshi e 120 para Kyoshi.
  await enviar('/api/modalidades/carencias', {
    modalidadeId: modalidade, meses_KYU_1: '12', meses_DAN_2: '24', meses_RENSHI: '60', meses_KYOSHI: '120',
  }, { cookie: diretoria })

  ids.danRecente = await praticante('Dan Recente', 7001)
  await graduar(ids.danRecente, 'DAN_1', daqui(-100))
  const acesso = await enviar(`/api/praticantes/${ids.danRecente}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', { token, senha: 'senha do dan', confirmacao: 'senha do dan' })
  danRecente = await entrar('x7001@teste.local', 'senha do dan')

  ids.aspirante = await praticante('Aspirante Antigo', 7002)
  await graduar(ids.aspirante, 'KYU_4', '2015-01-01')

  ids.semModalidade = await praticante('Sem Modalidade', 7003)

  ids.mukyu = await praticante('Mukyu Antigo', 7004)
  await graduar(ids.mukyu, null, '', '2010-01-01')

  ids.semBanca = await praticante('Dan Sem Banca', 7005)
  await graduar(ids.semBanca, 'DAN_2', '2015-01-01')

  ids.sextoDan = await praticante('Sexto Dan', 7006)
  await graduar(ids.sextoDan, 'DAN_6', '2015-01-01')

  ids.sextoRenshi = await praticante('Sexto Renshi', 7007)
  await graduar(ids.sextoRenshi, 'DAN_6', '2010-01-01')
  await registrarShogo(ids.sextoRenshi, 'RENSHI', '2012-01-01')

  // Renshi há 2 anos: o 5º dan é antigo, mas a carência do Kyoshi conta do Renshi.
  ids.quintoRenshi = await praticante('Quinto Renshi', 7008)
  await graduar(ids.quintoRenshi, 'DAN_5', '2005-01-01')
  await registrarShogo(ids.quintoRenshi, 'RENSHI', daqui(-730))

  ids.quintoDan = await praticante('Quinto Dan', 7009)
  await graduar(ids.quintoDan, 'DAN_5', daqui(-30))
}, 180_000)

describe('graduações com banca', () => {
  it('exame sem graduação oferecida não é publicado', async () => {
    const e = await exame('Exame Sem Banca Nenhuma', [])
    const resposta = await enviar('/api/eventos/publicar', { id: e.evento.id }, { cookie: diretoria })
    expect(resposta.problemas[0]).toContain('Ofereça ao menos uma graduação')
  })

  it('só oferece 1º kyu e dans, sem repetir', async () => {
    const e = await exame('Exame Com Banca Errada', [['KYU_1', '80']])

    expect((await oferecer(e.subeventoId, 'KYU_3', '50')).problemas[0]).toContain('1º kyu ou um dan')
    expect((await oferecer(e.subeventoId, 'KYU_1', '90')).problemas[0]).toContain('já oferece 1º kyu')
    expect((await oferecer(e.subeventoId, 'DAN_1', '')).problemas[0]).toContain('Use 0')
  })

  it('corrigir o valor não troca a graduação', async () => {
    const e = await exame('Exame Com Valor Corrigido', [['DAN_1', '150']])
    const oferecida = e.evento.subeventos[0]!.graduacoes[0]!

    await enviar('/api/eventos/graduacoes', {
      subeventoId: e.subeventoId, id: oferecida.id, grau: 'DAN_5', valor: '175',
    }, { cookie: diretoria })

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${e.evento.id}`, diretoria)
    expect(dados.subeventos[0]!.graduacoes).toMatchObject([{ grau: 'DAN_1', valor: 175 }])
  })

  it('praticante não mexe nas graduações nem na carência', async () => {
    const e = await exame('Exame Protegido', BANCAS)
    expect((await enviar('/api/eventos/graduacoes', { subeventoId: e.subeventoId, grau: 'DAN_3', valor: '1' },
      { cookie: danRecente })).status).toBe(403)
    expect((await enviar('/api/modalidades/carencias', { modalidadeId: modalidade, meses_DAN_2: '0' },
      { cookie: danRecente })).status).toBe(403)
  })
})

describe('tabela de carência', () => {
  it('grava, recusa texto e apaga o que ficou em branco', async () => {
    await enviar('/api/modalidades', { nome: 'Iaido Carência', kyuInicial: '5', ativa: 'on' }, { cookie: diretoria })
    const lista = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
    const iaido = lista.dados.find(m => m.nome === 'Iaido Carência')!.id

    const invalida = await enviar('/api/modalidades/carencias', { modalidadeId: iaido, meses_DAN_1: 'um ano' },
      { cookie: diretoria })
    expect(invalida.problemas[0]).toContain('1º dan')

    await enviar('/api/modalidades/carencias', { modalidadeId: iaido, meses_DAN_1: '12', meses_DAN_3: '36' },
      { cookie: diretoria })
    await enviar('/api/modalidades/carencias', { modalidadeId: iaido, meses_DAN_1: '12', meses_DAN_3: '' },
      { cookie: diretoria })

    const { dados } = await ler<Array<{ id: string, carencias: Array<{ grau: string, mesesMinimos: number }> }>>(
      '/api/modalidades', diretoria)
    expect(dados.find(m => m.id === iaido)!.carencias).toEqual([{ grau: 'DAN_1', shogo: null, mesesMinimos: 12 }])
  })
})

describe('graduação pretendida', () => {
  it('a página mostra a graduação atual e a que será prestada', async () => {
    const e = await exame('Exame Da Situação', BANCAS)
    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${e.evento.slug}`, danRecente)

    expect(dados.examinando[e.subeventoId]).toEqual({
      grauAtual: 'DAN_1', shogosAtuais: [], grau: 'DAN_2', temBancaDeGrau: true, shogo: null, temBancaDeShogo: false,
    })
  })

  it('inscreve para a graduação seguinte, com o valor dela', async () => {
    const e = await exame('Exame Do Segundo Dan', BANCAS)
    expect((await inscrever(e, danRecente)).ok).toBe(true)

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${e.evento.slug}`, danRecente)
    expect(dados.inscricao?.exames).toEqual({ [e.subeventoId]: { grau: 'DAN_2', shogo: null } })
    expect(dados.inscricao?.total).toBe(200)
  })

  it('aspirante vai direto ao 1º kyu', async () => {
    const e = await exame('Exame Do Aspirante', BANCAS)
    expect((await inscrever(e, diretoria, ids.aspirante)).ok).toBe(true)

    const { dados } = await ler<EventoDetalhado>(
      `/api/eventos/${e.evento.slug}?praticante=${ids.aspirante}`, diretoria)
    expect(dados.inscricao?.exames).toEqual({ [e.subeventoId]: { grau: 'KYU_1', shogo: null } })
    expect(dados.inscricao?.total).toBe(80)
  })

  it('recusa quando não haverá banca para a graduação seguinte — também para a diretoria', async () => {
    const e = await exame('Exame Sem Terceiro Dan', BANCAS)
    const resposta = await inscrever(e, diretoria, ids.semBanca)
    expect(resposta.problemas[0]).toContain('não haverá banca para 3º dan')
  })
})

describe('lista de inscritos', () => {
  it('avisa quem não cumpre a carência, sem impedir a inscrição', async () => {
    const e = await exame('Exame Com Carência', BANCAS)
    await inscrever(e, danRecente)
    await inscrever(e, diretoria, ids.aspirante)
    await inscrever(e, diretoria, ids.semModalidade)
    await inscrever(e, diretoria, ids.mukyu)

    const { dados } = await ler<InscritosDoEvento>(`/api/eventos/${e.evento.id}/inscritos`, diretoria)
    const aviso = (nome: string) => dados.inscritos.find(i => i.nome === nome)!.avisosDeCarencia[e.subeventoId]

    expect(dados.inscritos).toHaveLength(4)
    // 1º dan há 100 dias; 2º dan pede 24 meses.
    expect(aviso('Dan Recente')).toContain('carência não cumprida')
    // 4º kyu desde 2015; 1º kyu pede 12 meses.
    expect(aviso('Aspirante Antigo')).toBeUndefined()
    // Sem a modalidade no cadastro, não há data para conferir.
    expect(aviso('Sem Modalidade')).toContain('desconhecida')
    // Mukyu conta da data em que começou na modalidade.
    expect(aviso('Mukyu Antigo')).toBeUndefined()
  })

  it('remover graduação com inscritos pede confirmação e tira só do exame', async () => {
    const e = await exame('Exame Que Perde Uma Banca', BANCAS)
    await inscrever(e, danRecente)
    const segundoDan = e.evento.subeventos[0]!.graduacoes.find(g => g.grau === 'DAN_2')!

    const sem = await enviar('/api/eventos/graduacoes/remover', { id: segundoDan.id }, { cookie: diretoria })
    expect(sem.problemas[0]).toContain('1 inscrito(s) prestariam 2º dan')

    await enviar('/api/eventos/graduacoes/remover', { id: segundoDan.id, confirmar: 'on' }, { cookie: diretoria })

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${e.evento.slug}`, danRecente)
    expect(dados.inscricao).toBeNull()
    expect(dados.examinando[e.subeventoId]!.temBancaDeGrau).toBe(false)
  })
})

const BANCAS_COM_SHOGO: Array<[string, string]> = [['DAN_7', '250']]

async function exameComShogo(titulo: string): Promise<Exame> {
  const e = await exame(titulo, BANCAS_COM_SHOGO)
  await enviar('/api/eventos/shogos', { subeventoId: e.subeventoId, shogo: 'RENSHI', valor: '300' },
    { cookie: diretoria })
  await enviar('/api/eventos/shogos', { subeventoId: e.subeventoId, shogo: 'KYOSHI', valor: '400' },
    { cookie: diretoria })
  const { dados } = await ler<EventoDetalhado>(`/api/eventos/${e.evento.id}`, diretoria)
  return { evento: dados, subeventoId: e.subeventoId }
}

function inscreverNoExame(e: Exame, praticanteId: string, campos: Record<string, string> = {}) {
  return enviar('/api/eventos/inscricao', {
    eventoId: e.evento.id, praticanteId, [`subevento_${e.subeventoId}`]: 'on', ...campos,
  }, { cookie: diretoria })
}

async function examesDe(e: Exame, praticanteId: string) {
  const { dados } = await ler<EventoDetalhado>(
    `/api/eventos/${e.evento.slug}?praticante=${praticanteId}`, diretoria)
  return { exame: dados.inscricao?.exames[e.subeventoId] ?? null, total: dados.inscricao?.total ?? null }
}

describe('shogo', () => {
  it('só oferece Renshi e Kyoshi, sem repetir', async () => {
    const e = await exameComShogo('Exame Com Shogo Repetido')
    const repetido = await enviar('/api/eventos/shogos',
      { subeventoId: e.subeventoId, shogo: 'RENSHI', valor: '1' }, { cookie: diretoria })
    expect(repetido.problemas[0]).toContain('já oferece Renshi')

    const inventado = await enviar('/api/eventos/shogos',
      { subeventoId: e.subeventoId, shogo: 'HANSHI', valor: '1' }, { cookie: diretoria })
    expect(inventado.problemas[0]).toContain('Renshi ou Kyoshi')
  })

  it('quem pode prestar dan e shogo escolhe, e pode prestar os dois', async () => {
    const e = await exameComShogo('Exame Do Sexto Dan')

    const semEscolha = await inscreverNoExame(e, ids.sextoDan!)
    expect(semEscolha.problemas[0]).toContain('ou os dois')

    await inscreverNoExame(e, ids.sextoDan!, {
      [`exame_grau_${e.subeventoId}`]: 'on', [`exame_shogo_${e.subeventoId}`]: 'on',
    })
    expect(await examesDe(e, ids.sextoDan!)).toEqual({ exame: { grau: 'DAN_7', shogo: 'RENSHI' }, total: 550 })
  })

  it('quem tem Renshi escolhe entre o dan seguinte e o Kyoshi', async () => {
    const e = await exameComShogo('Exame Do Sexto Renshi')
    expect((await inscreverNoExame(e, ids.sextoRenshi!, { [`exame_grau_${e.subeventoId}`]: 'on' })).ok).toBe(true)
    expect(await examesDe(e, ids.sextoRenshi!)).toEqual({ exame: { grau: 'DAN_7', shogo: null }, total: 250 })
  })

  it('Kyoshi para qualquer detentor de Renshi', async () => {
    const e = await exameComShogo('Exame Do Quinto Renshi')
    // Sem banca de 6º dan: presta só o Kyoshi.
    expect((await inscreverNoExame(e, ids.quintoRenshi!)).ok).toBe(true)
    expect(await examesDe(e, ids.quintoRenshi!)).toEqual({ exame: { grau: null, shogo: 'KYOSHI' }, total: 400 })
  })

  it('Renshi a partir do 5º dan', async () => {
    const e = await exameComShogo('Exame Do Quinto Dan')
    expect((await inscreverNoExame(e, ids.quintoDan!)).ok).toBe(true)
    expect(await examesDe(e, ids.quintoDan!)).toEqual({ exame: { grau: null, shogo: 'RENSHI' }, total: 300 })
  })

  it('a carência do shogo aparece na lista de inscritos', async () => {
    const e = await exameComShogo('Exame Com Carencia De Renshi')
    await inscreverNoExame(e, ids.quintoDan!)
    await inscreverNoExame(e, ids.sextoDan!, { [`exame_shogo_${e.subeventoId}`]: 'on' })
    await inscreverNoExame(e, ids.quintoRenshi!)

    const { dados } = await ler<InscritosDoEvento>(`/api/eventos/${e.evento.id}/inscritos`, diretoria)
    const aviso = (nome: string) => dados.inscritos.find(i => i.nome === nome)!.avisosDeCarencia[e.subeventoId]

    // 5º dan há 30 dias; Renshi pede 60 meses.
    expect(aviso('Quinto Dan')).toContain('Renshi: carência não cumprida')
    expect(aviso('Sexto Dan')).toBeUndefined()
    // 5º dan desde 2005, mas Renshi há 2 anos; Kyoshi pede 120 meses do Renshi.
    expect(aviso('Quinto Renshi')).toContain('Kyoshi: carência não cumprida')
  })

  it('remover o shogo tira só esse exame: quem prestava os dois fica no dan', async () => {
    const e = await exameComShogo('Exame Que Perde O Renshi')
    await inscreverNoExame(e, ids.quintoDan!)
    await inscreverNoExame(e, ids.sextoDan!, {
      [`exame_grau_${e.subeventoId}`]: 'on', [`exame_shogo_${e.subeventoId}`]: 'on',
    })
    const renshi = e.evento.subeventos[0]!.shogos.find(s => s.shogo === 'RENSHI')!

    const sem = await enviar('/api/eventos/shogos/remover', { id: renshi.id }, { cookie: diretoria })
    expect(sem.problemas[0]).toContain('2 inscrito(s) prestariam Renshi')

    await enviar('/api/eventos/shogos/remover', { id: renshi.id, confirmar: 'on' }, { cookie: diretoria })

    expect((await examesDe(e, ids.sextoDan!)).exame).toEqual({ grau: 'DAN_7', shogo: null })
    expect((await examesDe(e, ids.quintoDan!)).exame).toBeNull()
  })

  it('remover a banca de dan tira só esse exame: quem prestava os dois fica no shogo', async () => {
    const e = await exameComShogo('Exame Que Perde O Setimo Dan')
    await inscreverNoExame(e, ids.sextoDan!, {
      [`exame_grau_${e.subeventoId}`]: 'on', [`exame_shogo_${e.subeventoId}`]: 'on',
    })
    const setimo = e.evento.subeventos[0]!.graduacoes.find(g => g.grau === 'DAN_7')!

    await enviar('/api/eventos/graduacoes/remover', { id: setimo.id, confirmar: 'on' }, { cookie: diretoria })
    expect((await examesDe(e, ids.sextoDan!)).exame).toEqual({ grau: null, shogo: 'RENSHI' })
  })
})

describe('shogo no cadastro', () => {
  let id = ''

  beforeAll(async () => {
    id = await praticante('Titulos No Cadastro', 7010)
    await graduar(id, 'DAN_4', '2010-01-01')
  })

  it('Renshi pede 5º dan e Kyoshi pede Renshi', async () => {
    expect((await registrarShogo(id, 'RENSHI', '2015-01-01')).problemas[0]).toContain('5º dan')

    await graduar(id, 'DAN_5', '2014-01-01')
    expect((await registrarShogo(id, 'KYOSHI', '2020-01-01')).problemas[0]).toContain('pede Renshi')
    expect((await registrarShogo(id, 'RENSHI', '2015-01-01')).ok).toBe(true)
    expect((await registrarShogo(id, 'KYOSHI', '2014-06-01')).problemas[0]).toContain('anterior ao Renshi')
    expect((await registrarShogo(id, 'KYOSHI', '2020-01-01')).ok).toBe(true)

    const { dados } = await ler<{ modalidades: Array<{ shogos: Array<{ shogo: string }> }> }>(
      `/api/praticantes/${id}`, diretoria)
    expect(dados.modalidades[0]!.shogos.map(s => s.shogo)).toEqual(['RENSHI', 'KYOSHI'])
  })

  it('não deixa o título sem base', async () => {
    const baixar = await enviar(`/api/praticantes/${id}/graduacao`,
      { modalidadeId: modalidade, grau: 'DAN_4', graduadoEm: '2010-01-01' }, { cookie: diretoria })
    expect(baixar.problemas[0]).toContain('Remova o título antes')

    const remover = (shogo: string) => enviar(`/api/praticantes/${id}/shogos/remover`,
      { modalidadeId: modalidade, shogo }, { cookie: diretoria })
    expect((await remover('RENSHI')).problemas[0]).toContain('Remova o Kyoshi antes')
    expect((await remover('KYOSHI')).ok).toBe(true)
    expect((await remover('RENSHI')).ok).toBe(true)
  })

  it('praticante não registra título', async () => {
    const resposta = await enviar(`/api/praticantes/${ids.danRecente}/shogos`,
      { modalidadeId: modalidade, shogo: 'RENSHI', obtidoEm: '2020-01-01' }, { cookie: danRecente })
    expect(resposta.status).toBe(403)
  })
})

describe('telas', () => {
  async function html(caminho: string, cookie: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: { cookie } })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('a inscrição mostra a graduação que será prestada', async () => {
    const e = await exame('Exame Na Tela', BANCAS)
    const { texto } = await html(`/agenda/${e.evento.slug}`, danRecente)
    expect(texto).toMatch(/Exame para\s*<strong>2º dan<\/strong>/)
  })

  it('quem pode prestar dan e shogo vê as duas opções', async () => {
    const e = await exameComShogo('Exame Com Escolha Na Tela')
    const { texto } = await html(`/agenda/${e.evento.slug}?praticante=${ids.sextoDan}`, diretoria)
    expect(texto).toContain(`name="exame_grau_${e.subeventoId}"`)
    expect(texto).toContain(`name="exame_shogo_${e.subeventoId}"`)
  })

  it('a ficha do praticante mostra o título e o formulário do seguinte', async () => {
    const { texto } = await html(`/praticantes/${ids.sextoRenshi}`, diretoria)
    expect(texto).toContain('Renshi')
  })

  it('a edição do evento traz as graduações, e a de modalidades a carência', async () => {
    const e = await exame('Exame Na Tela Da Diretoria', BANCAS)
    const edicao = await html(`/eventos/${e.evento.id}`, diretoria)
    expect(edicao.texto).toContain('action="/api/eventos/graduacoes"')
    expect(edicao.texto).toContain('action="/api/eventos/graduacoes/remover"')
    expect(edicao.texto).toContain('action="/api/eventos/shogos"')

    const modalidades = await html('/modalidades', diretoria)
    expect(modalidades.texto).toContain('action="/api/modalidades/carencias"')
    expect(modalidades.texto).toContain('name="meses_DAN_1"')
    expect(modalidades.texto).toContain('name="meses_RENSHI"')
  })
})
