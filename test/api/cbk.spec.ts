import { beforeAll, describe, expect, it } from 'vitest'
import type { ColunaCbk, LinhaCbk, ResumoDaCompeticao } from '../../shared/cbk'
import type { EventoDetalhado } from '../../shared/evento'
import { ENDERECO, comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * Dados para a CBK (etapa 7.4): a tabela na ordem da planilha, e o nome no
 * zekken e a posição na equipe, que a diretoria anota.
 *
 * Três cadastros:
 * - Ana, 2º dan: seminário nos dois dias, exame, individual e equipe, obento;
 * - Beto, mukyu: só o individual;
 * - Carla: só encomendou obento.
 */

interface DadosCbk {
  evento: { id: string, inscricoesAbertas: boolean }
  colunas: ColunaCbk[]
  linhas: LinhaCbk[]
  resumo: ResumoDaCompeticao[]
}

let diretoria = ''
let ana = ''
let modalidade = ''
const ids: Record<string, string> = {}

function daqui(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

const DIA_1 = daqui(20)
const DIA_2 = daqui(21)

async function praticante(nome: string, semente: number, sexo = 'FEMININO') {
  const criado = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: nome, documento: gerarCpf(semente), email: `c${semente}@teste.local`,
    sexo, dataNascimento: '1990-05-10',
  }), { cookie: diretoria })
  if (!criado.ok) throw new Error(`${nome}: ${criado.problemas.join('; ')}`)
  return criado.destino.split('/').pop()!
}

interface Torneio {
  eventoId: string
  slug: string
  seminario: string
  exame: string
  competicao: string
  individual: string
  equipe: string
}

/** Evento publicado com seminário de dois dias, exame, competição e obento. */
async function torneio(titulo: string): Promise<Torneio> {
  const criado = await enviar('/api/eventos', {
    titulo, descricao: 'Campeonato.', prazoInscricao: daqui(10), visibilidade: 'PUBLICA',
  }, { cookie: diretoria })
  if (!criado.ok) throw new Error(`${titulo}: ${criado.problemas.join('; ')}`)
  const eventoId = criado.destino.split('/').pop()!

  const subevento = (tipo: string, campos: Record<string, string>) =>
    enviar('/api/eventos/subeventos', {
      eventoId, tipo, modalidadeId: modalidade, local: 'Ginásio', valor: '0', ...campos,
    }, { cookie: diretoria })

  await subevento('SEMINARIO', { dia_1: DIA_1, dia_2: DIA_2 })
  await subevento('EXAME', { dia_1: DIA_2 })
  await subevento('COMPETICAO', { dia_1: DIA_1, valor: '50,00' })

  await enviar('/api/eventos', {
    id: eventoId, titulo, descricao: 'Campeonato.', prazoInscricao: daqui(10),
    valorObento: '20', [`obento_${DIA_1}`]: 'on',
  }, { cookie: diretoria })

  let { dados: evento } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)
  const de = (tipo: string) => evento.subeventos.find(s => s.tipo === tipo)!.id
  const competicao = de('COMPETICAO')

  await enviar('/api/eventos/graduacoes', { subeventoId: de('EXAME'), grau: 'DAN_3', valor: '100' },
    { cookie: diretoria })
  await enviar('/api/eventos/categorias', {
    subeventoId: competicao, tipo: 'INDIVIDUAL', nome: 'Adulto', sexo: 'MISTO', idadeMinima: '18',
  }, { cookie: diretoria })
  await enviar('/api/eventos/categorias', {
    subeventoId: competicao, tipo: 'EQUIPE', nome: 'Equipe adulto', sexo: 'MISTO', idadeMinima: '18',
  }, { cookie: diretoria })

  const publicado = await enviar('/api/eventos/publicar', { id: eventoId }, { cookie: diretoria })
  if (!publicado.ok) throw new Error(`${titulo}: ${publicado.problemas.join('; ')}`)

  evento = (await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)).dados
  const categorias = Object.fromEntries(evento.subeventos.find(s => s.id === competicao)!.categorias
    .map(c => [c.nome, c.id]))

  return {
    eventoId, slug: evento.slug, seminario: de('SEMINARIO'), exame: de('EXAME'), competicao,
    individual: categorias.Adulto!, equipe: categorias['Equipe adulto']!,
  }
}

function inscrever(t: Torneio, praticanteId: string, campos: Record<string, string>) {
  return enviar('/api/eventos/inscricao', { eventoId: t.eventoId, praticanteId, ...campos }, { cookie: diretoria })
}

/** Ana nos dois dias de seminário, no exame, no individual e na equipe, com 2 obentos. */
function inscreverAna(t: Torneio, extra: Record<string, string> = {}) {
  return inscrever(t, ids.ana!, {
    [`subevento_${t.seminario}`]: 'on',
    [`subevento_${t.exame}`]: 'on',
    [`subevento_${t.competicao}`]: 'on',
    [`individual_${t.competicao}`]: t.individual,
    [`equipe_${t.competicao}`]: t.equipe,
    [`obento_${DIA_1}`]: '2',
    ...extra,
  })
}

function inscreverBeto(t: Torneio) {
  return inscrever(t, ids.beto!, {
    [`subevento_${t.competicao}`]: 'on', [`individual_${t.competicao}`]: t.individual,
  })
}

async function dadosCbk(t: Torneio, cookie = diretoria) {
  return (await ler<DadosCbk>(`/api/eventos/${t.eventoId}/cbk`, cookie)).dados
}

const linha = (dados: DadosCbk, nome: string) => dados.linhas.find(l => l.nome.startsWith(nome))!

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/modalidades', { nome: 'Kendo CBK', kyuInicial: '6', ativa: 'on' }, { cookie: diretoria })
  const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
  modalidade = dados.find(m => m.nome === 'Kendo CBK')!.id

  ids.ana = await praticante('Ana Segundo Dan', 8001)
  await enviar(`/api/praticantes/${ids.ana}/modalidades`, { modalidadeId: modalidade, desde: '2010-01-01' },
    { cookie: diretoria })
  await enviar(`/api/praticantes/${ids.ana}/graduacao`, {
    modalidadeId: modalidade, grau: 'DAN_2', graduadoEm: '2020-06-01',
  }, { cookie: diretoria })

  ids.beto = await praticante('Beto Mukyu', 8002, 'MASCULINO')
  ids.carla = await praticante('Carla Obento', 8003)

  const acesso = await enviar(`/api/praticantes/${ids.ana}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', { token, senha: 'senha da ana', confirmacao: 'senha da ana' })
  ana = await entrar('c8001@teste.local', 'senha da ana')
}, 180_000)

describe('tabela dos dados da CBK', () => {
  it('traz as colunas na ordem da planilha e uma linha por inscrito', async () => {
    const t = await torneio('Taikai Dos Dados')
    await inscreverAna(t)
    await inscreverBeto(t)
    await inscrever(t, ids.carla!, { [`obento_${DIA_1}`]: '1' })

    const dados = await dadosCbk(t)
    expect(dados.colunas.map(c => c.rotulo)).toEqual([
      expect.stringMatching(/^Seminário — /),
      expect.stringMatching(/^Seminário — /),
      'Exame',
      'Exame — o que presta',
      'Competição individual',
      'Competição — categoria individual',
      'Competição por equipes — posição na primeira luta',
      'Competição — categoria por equipes',
      'Competição — nome no zekken/nafuda',
      expect.stringMatching(/^Obento — /),
    ])
    expect(dados.linhas.map(l => l.nome)).toEqual(['Ana Segundo Dan', 'Beto Mukyu', 'Carla Obento'])
  })

  it('mostra o que cada um vai fazer', async () => {
    const t = await torneio('Taikai Das Células')
    await inscreverAna(t)
    await inscreverBeto(t)
    await inscrever(t, ids.carla!, { [`obento_${DIA_1}`]: '1' })

    const dados = await dadosCbk(t)
    const anaLinha = linha(dados, 'Ana')
    expect(anaLinha.celulas[`seminario:${t.seminario}:${DIA_1}`]).toBe('S')
    expect(anaLinha.celulas[`seminario:${t.seminario}:${DIA_2}`]).toBe('S')
    expect(anaLinha.celulas[`exame:${t.exame}`]).toBe('S')
    expect(anaLinha.celulas[`exame-grau:${t.exame}`]).toBe('3º dan')
    expect(anaLinha.celulas[`competicao:${t.competicao}:categoria-individual`]).toBe('Adulto')
    expect(anaLinha.celulas[`competicao:${t.competicao}:categoria-equipe`]).toBe('Equipe adulto')
    expect(anaLinha.celulas[`obento:${DIA_1}`]).toBe('2')

    const beto = linha(dados, 'Beto')
    expect(beto.celulas[`seminario:${t.seminario}:${DIA_1}`]).toBe('N')
    expect(beto.celulas[`competicao:${t.competicao}:individual`]).toBe('S')
    expect(beto.celulas[`competicao:${t.competicao}:equipe`]).toBe('N')

    const carla = linha(dados, 'Carla')
    expect(carla.celulas[`competicao:${t.competicao}:individual`]).toBe('N')
    expect(carla.celulas[`obento:${DIA_1}`]).toBe('1')
  })

  it('avisa que as inscrições ainda estão abertas', async () => {
    const t = await torneio('Taikai Ainda Aberto')
    expect((await dadosCbk(t)).evento.inscricoesAbertas).toBe(true)
  })

  it('só a diretoria vê e grava', async () => {
    const t = await torneio('Taikai Só Da Diretoria')
    await inscreverAna(t)

    const leitura = await fetch(`${ENDERECO}/api/eventos/${t.eventoId}/cbk`, { headers: { cookie: ana } })
    expect(leitura.status).toBe(403)

    const gravacao = await enviar('/api/eventos/cbk', { eventoId: t.eventoId }, { cookie: ana })
    expect(gravacao.status).toBe(403)
  })
})

describe('nome no zekken e posição na equipe', () => {
  async function fichaDaAna(t: Torneio) {
    return linha(await dadosCbk(t), 'Ana').fichas[0]!.inscricaoSubeventoId
  }

  it('a diretoria anota, inclusive avulso, e o dado fica para novas consultas', async () => {
    const t = await torneio('Taikai Da Anotação')
    await inscreverAna(t)
    const ficha = await fichaDaAna(t)

    const resposta = await enviar('/api/eventos/cbk', {
      eventoId: t.eventoId, [`zekken_${ficha}`]: 'Segundo Dan', [`posicao_${ficha}`]: 'AVULSO',
    }, { cookie: diretoria })
    expect(resposta.ok).toBe(true)

    const dados = await dadosCbk(t)
    const celulas = linha(dados, 'Ana').celulas
    expect(celulas[`competicao:${t.competicao}:zekken`]).toBe('Segundo Dan')
    expect(celulas[`competicao:${t.competicao}:equipe`]).toBe('Avulso')
    expect(dados.resumo).toEqual([expect.objectContaining({ individuais: 1, equipes: 1, avulsos: 1 })])
  })

  it('só os campos enviados mudam, e vazio apaga', async () => {
    const t = await torneio('Taikai Dos Campos Parciais')
    await inscreverAna(t)
    const ficha = await fichaDaAna(t)

    await enviar('/api/eventos/cbk', {
      eventoId: t.eventoId, [`zekken_${ficha}`]: 'Ana', [`posicao_${ficha}`]: 'TAISHO',
    }, { cookie: diretoria })
    await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`zekken_${ficha}`]: 'Ana S.' },
      { cookie: diretoria })

    const celulas = () => linha(atual, 'Ana').celulas
    let atual = await dadosCbk(t)
    expect(celulas()[`competicao:${t.competicao}:zekken`]).toBe('Ana S.')
    expect(celulas()[`competicao:${t.competicao}:equipe`]).toBe('Taisho')

    await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`posicao_${ficha}`]: '' }, { cookie: diretoria })
    atual = await dadosCbk(t)
    expect(celulas()[`competicao:${t.competicao}:equipe`]).toBe('')
  })

  it('recusa posição para quem não compete por equipes', async () => {
    const t = await torneio('Taikai Do Individual')
    await inscreverBeto(t)
    const ficha = linha(await dadosCbk(t), 'Beto').fichas[0]!.inscricaoSubeventoId

    const resposta = await enviar('/api/eventos/cbk', {
      eventoId: t.eventoId, [`posicao_${ficha}`]: 'SENPO', [`zekken_${ficha}`]: 'Beto',
    }, { cookie: diretoria })
    expect(resposta.problemas[0]).toContain('não compete por equipes')

    // Nada foi gravado, nem o zekken: a gravação é toda ou nenhuma.
    expect(linha(await dadosCbk(t), 'Beto').celulas[`competicao:${t.competicao}:zekken`]).toBe('')

    // O zekken sozinho vale.
    const soZekken = await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`zekken_${ficha}`]: 'Beto' },
      { cookie: diretoria })
    expect(soZekken.ok).toBe(true)
  })

  it('recusa posição inventada, zekken longo e inscrição de outro evento', async () => {
    const t = await torneio('Taikai Dos Erros')
    const outro = await torneio('Taikai De Outro Evento')
    await inscreverAna(t)
    await inscreverAna(outro)
    const ficha = await fichaDaAna(t)
    const fichaDeOutro = await fichaDaAna(outro)

    const invalida = await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`posicao_${ficha}`]: 'REI' },
      { cookie: diretoria })
    expect(invalida.problemas[0]).toContain('posição inválida')

    const longo = await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`zekken_${ficha}`]: 'x'.repeat(41) },
      { cookie: diretoria })
    expect(longo.problemas[0]).toContain('no máximo 40')

    const alheia = await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`zekken_${fichaDeOutro}`]: 'Ana' },
      { cookie: diretoria })
    expect(alheia.problemas[0]).toContain('não são deste evento')
  })

  it('sair da disputa por equipes apaga a posição, e o nome no zekken fica', async () => {
    const t = await torneio('Taikai Da Saída Da Equipe')
    await inscreverAna(t)
    const ficha = await fichaDaAna(t)
    await enviar('/api/eventos/cbk', {
      eventoId: t.eventoId, [`zekken_${ficha}`]: 'Ana', [`posicao_${ficha}`]: 'SENPO',
    }, { cookie: diretoria })

    // Mesma inscrição, agora só no individual.
    await inscreverAna(t, { [`equipe_${t.competicao}`]: '' })

    const celulas = linha(await dadosCbk(t), 'Ana').celulas
    expect(celulas[`competicao:${t.competicao}:equipe`]).toBe('N')
    expect(celulas[`competicao:${t.competicao}:zekken`]).toBe('Ana')

    // Voltando para a equipe, a posição recomeça em branco.
    await inscreverAna(t)
    expect(linha(await dadosCbk(t), 'Ana').celulas[`competicao:${t.competicao}:equipe`]).toBe('')
  })

  it('alterar a inscrição por outro motivo não apaga o que a diretoria anotou', async () => {
    const t = await torneio('Taikai Do Obento Trocado')
    await inscreverAna(t)
    const ficha = await fichaDaAna(t)
    await enviar('/api/eventos/cbk', {
      eventoId: t.eventoId, [`zekken_${ficha}`]: 'Ana', [`posicao_${ficha}`]: 'JIHO',
    }, { cookie: diretoria })

    await inscreverAna(t, { [`obento_${DIA_1}`]: '5' })

    const celulas = linha(await dadosCbk(t), 'Ana').celulas
    expect(celulas[`obento:${DIA_1}`]).toBe('5')
    expect(celulas[`competicao:${t.competicao}:equipe`]).toBe('Jiho')
    expect(celulas[`competicao:${t.competicao}:zekken`]).toBe('Ana')
  })

  it('remover a categoria de equipe apaga as posições', async () => {
    const t = await torneio('Taikai Da Categoria Removida')
    await inscreverAna(t)
    const ficha = await fichaDaAna(t)
    await enviar('/api/eventos/cbk', { eventoId: t.eventoId, [`posicao_${ficha}`]: 'CHUKEN' },
      { cookie: diretoria })

    await enviar('/api/eventos/categorias/remover', { id: t.equipe, confirmar: 'on' }, { cookie: diretoria })

    const celulas = linha(await dadosCbk(t), 'Ana').celulas
    expect(celulas[`competicao:${t.competicao}:equipe`]).toBe('N')
    expect(celulas[`competicao:${t.competicao}:categoria-equipe`]).toBe('—')
  })
})

describe('tela', () => {
  async function html(caminho: string, cookie: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: { cookie } })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('traz os campos de zekken e posição com os nomes que o servidor lê', async () => {
    const t = await torneio('Taikai Na Tela')
    await inscreverAna(t)
    await inscreverBeto(t)
    const ficha = linha(await dadosCbk(t), 'Ana').fichas[0]!.inscricaoSubeventoId
    const fichaDoBeto = linha(await dadosCbk(t), 'Beto').fichas[0]!.inscricaoSubeventoId

    const { status, texto } = await html(`/eventos/${t.eventoId}/cbk`, diretoria)
    expect(status).toBe(200)
    expect(texto).toContain('action="/api/eventos/cbk"')
    expect(texto).toContain(`name="zekken_${ficha}"`)
    expect(texto).toContain(`name="posicao_${ficha}"`)
    expect(texto).toContain('value="AVULSO"')
    // Beto compete só no individual: tem zekken, mas não posição.
    expect(texto).toContain(`name="zekken_${fichaDoBeto}"`)
    expect(texto).not.toContain(`name="posicao_${fichaDoBeto}"`)
  })

  it('a tela só abre para a diretoria', async () => {
    const t = await torneio('Taikai Da Tela Protegida')
    const resposta = await fetch(`${ENDERECO}/eventos/${t.eventoId}/cbk`, {
      headers: { cookie: ana }, redirect: 'manual',
    })
    expect(resposta.status).not.toBe(200)
  })
})
