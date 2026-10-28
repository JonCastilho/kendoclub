import { beforeAll, describe, expect, it } from 'vitest'
import type { EventoDetalhado, InscritosDoEvento } from '../../shared/evento'
import { ENDERECO, comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * Competição (etapa 7.2): tabela de categorias, separada em individual e por
 * equipes, com as categorias que servem tiradas do cadastro.
 *
 * Duas pessoas com cadastros escolhidos para cair em casos diferentes:
 * - a kenshi, 2º dan, feminino: serve em duas categorias individuais e precisa
 *   escolher; na disputa por equipes serve em uma só;
 * - o mukyu, masculino, sem a modalidade no cadastro: serve em uma de cada.
 */

let diretoria = ''
let kenshi = ''
let kenshiId = ''
let mukyuId = ''
let modalidade = ''

function daqui(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

const anoDoEvento = Number(daqui(20).slice(0, 4))

interface Competicao {
  evento: EventoDetalhado
  subeventoId: string
  categorias: Record<string, string>
}

async function categoria(subeventoId: string, campos: Record<string, string>) {
  return enviar('/api/eventos/categorias', {
    subeventoId, tipo: 'INDIVIDUAL', sexo: 'MISTO', ...campos,
  }, { cookie: diretoria })
}

/** Evento com uma competição, as categorias pedidas e, se possível, publicado. */
async function competicao(titulo: string, tabela: Array<Record<string, string>>): Promise<Competicao> {
  const criado = await enviar('/api/eventos', {
    titulo, descricao: 'Campeonato.', prazoInscricao: daqui(10), visibilidade: 'PUBLICA',
  }, { cookie: diretoria })
  if (!criado.ok) throw new Error(`${titulo}: ${criado.problemas.join('; ')}`)
  const eventoId = criado.destino.split('/').pop()!

  await enviar('/api/eventos/subeventos', {
    eventoId, tipo: 'COMPETICAO', modalidadeId: modalidade, local: 'Ginásio', dia_1: daqui(20),
    valor: '50,00',
  }, { cookie: diretoria })

  // O obento só pode ser oferecido depois de haver dia com subevento.
  await enviar('/api/eventos', {
    id: eventoId, titulo, descricao: 'Campeonato.', prazoInscricao: daqui(10),
    valorObento: '20', [`obento_${daqui(20)}`]: 'on',
  }, { cookie: diretoria })

  let { dados: evento } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)
  const subeventoId = evento.subeventos[0]!.id

  for (const linha of tabela) {
    const resposta = await categoria(subeventoId, linha)
    if (!resposta.ok) throw new Error(`${linha.nome}: ${resposta.problemas.join('; ')}`)
  }

  await enviar('/api/eventos/publicar', { id: eventoId }, { cookie: diretoria })
  evento = (await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)).dados

  const categorias = Object.fromEntries(evento.subeventos[0]!.categorias.map(c => [c.nome, c.id]))
  return { evento, subeventoId, categorias }
}

const TABELA: Array<Record<string, string>> = [
  { nome: 'Feminino dan', sexo: 'FEMININO', grauMinimo: 'DAN_1', isenta: 'on' },
  { nome: 'Adulto', idadeMinima: '18' },
  { nome: 'Juvenil', idadeMaxima: '17' },
  { nome: 'Equipe adulto', tipo: 'EQUIPE', idadeMinima: '18' },
  { nome: 'Equipe juvenil', tipo: 'EQUIPE', idadeMaxima: '17' },
]

function inscrever(c: Competicao, campos: Record<string, string>, cookie = kenshi,
  opcoes: { nativo?: boolean } = {}) {
  return enviar('/api/eventos/inscricao', {
    eventoId: c.evento.id, [`subevento_${c.subeventoId}`]: 'on', ...campos,
  }, { cookie, nativo: opcoes.nativo })
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  await enviar('/api/modalidades', { nome: 'Kendo Competição', kyuInicial: '6', ativa: 'on' },
    { cookie: diretoria })
  const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
  modalidade = dados.find(m => m.nome === 'Kendo Competição')!.id

  const criada = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Kenshi Segundo Dan', documento: gerarCpf(6001), email: 'k6001@teste.local',
    sexo: 'FEMININO', dataNascimento: '1990-11-20',
  }), { cookie: diretoria })
  kenshiId = criada.destino.split('/').pop()!

  await enviar(`/api/praticantes/${kenshiId}/modalidades`, { modalidadeId: modalidade, desde: '2010-01-01' },
    { cookie: diretoria })
  await enviar(`/api/praticantes/${kenshiId}/graduacao`, {
    modalidadeId: modalidade, grau: 'DAN_2', graduadoEm: '2020-06-01',
  }, { cookie: diretoria })

  const acesso = await enviar(`/api/praticantes/${kenshiId}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', { token, senha: 'senha da kenshi', confirmacao: 'senha da kenshi' })
  kenshi = await entrar('k6001@teste.local', 'senha da kenshi')

  const mukyu = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Mukyu Sem Modalidade', documento: gerarCpf(6002), email: 'k6002@teste.local',
    sexo: 'MASCULINO', dataNascimento: '1988-03-01',
  }), { cookie: diretoria })
  mukyuId = mukyu.destino.split('/').pop()!
}, 180_000)

describe('tabela de categorias', () => {
  it('competição sem valor de participação não é publicada', async () => {
    const criado = await enviar('/api/eventos', {
      titulo: 'Taikai Sem Valor', descricao: 'x', prazoInscricao: daqui(10),
    }, { cookie: diretoria })
    const eventoId = criado.destino.split('/').pop()!
    const subevento = await enviar('/api/eventos/subeventos', {
      eventoId, tipo: 'COMPETICAO', modalidadeId: modalidade, local: 'Ginásio', dia_1: daqui(20),
    }, { cookie: diretoria })
    expect(subevento.ok).toBe(true)

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)
    await categoria(dados.subeventos[0]!.id, { nome: 'Aberta' })

    const publicar = await enviar('/api/eventos/publicar', { id: eventoId }, { cookie: diretoria })
    expect(publicar.problemas).toEqual(['Informe o valor de participação em competição de Kendo Competição antes de publicar.'])
  })

  it('competição sem categoria não é publicada', async () => {
    const c = await competicao('Taikai Sem Tabela', [])
    const resposta = await enviar('/api/eventos/publicar', { id: c.evento.id }, { cookie: diretoria })

    expect(resposta.problemas[0]).toContain('Cadastre ao menos uma categoria')
    expect(c.evento.publicadoEm).toBeNull()
  })

  it('recusa faixa invertida, graduação fora da modalidade e nome repetido', async () => {
    const c = await competicao('Taikai Com Tabela Errada', [{ nome: 'Adulto', idadeMinima: '18' }])

    expect((await categoria(c.subeventoId, { nome: 'Invertida', idadeMinima: '30', idadeMaxima: '18' }))
      .problemas[0]).toContain('mínima não pode ser maior')
    // A modalidade começa no 6º kyu.
    expect((await categoria(c.subeventoId, { nome: 'Oitavo kyu', grauMinimo: 'KYU_8' }))
      .problemas[0]).toContain('fora da faixa')
    expect((await categoria(c.subeventoId, { nome: 'Adulto' })).problemas[0])
      .toContain('já tem a categoria')
  })

  it('o mesmo nome pode existir nas duas disputas', async () => {
    const c = await competicao('Taikai Com Adulto Nas Duas', [{ nome: 'Adulto', idadeMinima: '18' }])

    const equipe = await categoria(c.subeventoId, { nome: 'Adulto', tipo: 'EQUIPE', idadeMinima: '18' })
    expect(equipe.ok).toBe(true)
    expect((await categoria(c.subeventoId, { nome: 'Adulto', tipo: 'EQUIPE' })).problemas[0])
      .toContain('já tem a categoria "Adulto" (por equipes)')
  })

  it('exige o tipo, e o tipo de uma categoria não muda depois de criada', async () => {
    const c = await competicao('Taikai Do Tipo Fixo', [{ nome: 'Adulto', idadeMinima: '18' }])

    expect((await categoria(c.subeventoId, { nome: 'Sem tipo', tipo: '' })).problemas[0])
      .toContain('individual ou por equipes')

    await categoria(c.subeventoId, { id: c.categorias.Adulto!, nome: 'Adulto', tipo: 'EQUIPE', idadeMinima: '18' })
    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${c.evento.id}`, diretoria)
    expect(dados.subeventos[0]!.categorias).toMatchObject([{ nome: 'Adulto', tipo: 'INDIVIDUAL' }])
  })

  it('só competição tem categoria', async () => {
    const criado = await enviar('/api/eventos', {
      titulo: 'Seminário Sem Categoria', descricao: 'x', prazoInscricao: daqui(10),
    }, { cookie: diretoria })
    const eventoId = criado.destino.split('/').pop()!
    await enviar('/api/eventos/subeventos', {
      eventoId, tipo: 'SEMINARIO', modalidadeId: modalidade, local: 'Dojo', dia_1: daqui(20), valor: '0',
    }, { cookie: diretoria })
    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${eventoId}`, diretoria)

    const resposta = await categoria(dados.subeventos[0]!.id, { nome: 'Indevida' })
    expect(resposta.problemas[0]).toContain('Só competição')
  })

  it('o tipo do subevento não muda depois de criado', async () => {
    const c = await competicao('Taikai Que Queria Ser Seminário', TABELA)
    const resposta = await enviar('/api/eventos/subeventos', {
      eventoId: c.evento.id, id: c.subeventoId, tipo: 'SEMINARIO', modalidadeId: modalidade,
      local: 'Ginásio', dia_1: daqui(20), valor: '0',
    }, { cookie: diretoria })

    expect(resposta.problemas[0]).toContain('não muda depois de criado')
  })

  it('praticante não mexe na tabela', async () => {
    const c = await competicao('Taikai Com Tabela Protegida', TABELA)
    const resposta = await enviar('/api/eventos/categorias', {
      subeventoId: c.subeventoId, nome: 'Da praticante', sexo: 'MISTO',
    }, { cookie: kenshi })
    expect(resposta.status).toBe(403)
  })
})

describe('categorias tiradas do cadastro', () => {
  it('mostra idade no ano, graduação e as categorias que servem', async () => {
    const c = await competicao('Taikai Da Situação', TABELA)
    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)

    // Nascida em novembro: a idade é a que completa no ano, mesmo antes do
    // aniversário.
    expect(dados.competidor[c.subeventoId]).toEqual({
      idade: anoDoEvento - 1990,
      grau: 'DAN_2',
      compativeis: [c.categorias['Feminino dan'], c.categorias.Adulto, c.categorias['Equipe adulto']],
    })
  })

  it('escolhe uma categoria de cada disputa, e paga a participação uma vez', async () => {
    const c = await competicao('Taikai Da Escolha', TABELA)
    const individual = `individual_${c.subeventoId}`
    const equipe = `equipe_${c.subeventoId}`

    const nenhuma = await inscrever(c, {})
    expect(nenhuma.problemas[0]).toContain('individual, por equipes')

    expect((await inscrever(c, { [individual]: c.categorias.Adulto! })).ok).toBe(true)
    const soIndividual = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)
    expect(soIndividual.dados.inscricao?.competicoes[c.subeventoId]).toEqual({
      categoriaIndividualId: c.categorias.Adulto, categoriaEquipeId: null,
    })
    expect(soIndividual.dados.inscricao?.total).toBe(50)

    expect((await inscrever(c, {
      [individual]: c.categorias.Adulto!, [equipe]: c.categorias['Equipe adulto']!,
    })).ok).toBe(true)
    const nasDuas = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)
    expect(nasDuas.dados.inscricao?.competicoes[c.subeventoId]).toEqual({
      categoriaIndividualId: c.categorias.Adulto, categoriaEquipeId: c.categorias['Equipe adulto'],
    })
    expect(nasDuas.dados.inscricao?.total).toBe(50)
  })

  it('recusa categoria que existe no evento mas não serve ao cadastro', async () => {
    const c = await competicao('Taikai Da Categoria Errada', TABELA)
    const individual = await inscrever(c, { [`individual_${c.subeventoId}`]: c.categorias.Juvenil! })
    expect(individual.problemas[0]).toContain('não atende')

    const equipe = await inscrever(c, { [`equipe_${c.subeventoId}`]: c.categorias['Equipe juvenil']! })
    expect(equipe.problemas[0]).toContain('não atende')
  })

  it('recusa categoria de uma disputa escolhida na outra', async () => {
    const c = await competicao('Taikai Da Disputa Trocada', TABELA)
    const resposta = await inscrever(c, { [`individual_${c.subeventoId}`]: c.categorias['Equipe adulto']! })
    expect(resposta.problemas[0]).toContain('não atende')
  })

  it('compete só por equipes — mukyu conta como sem graduação', async () => {
    const c = await competicao('Taikai Só Por Equipes', TABELA)

    const resposta = await inscrever(c, {
      praticanteId: mukyuId, [`equipe_${c.subeventoId}`]: c.categorias['Equipe adulto']!,
    }, diretoria)
    expect(resposta.ok).toBe(true)

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}?praticante=${mukyuId}`, diretoria)
    expect(dados.competidor[c.subeventoId]!.grau).toBeNull()
    expect(dados.inscricao?.competicoes[c.subeventoId]).toEqual({
      categoriaIndividualId: null, categoriaEquipeId: c.categorias['Equipe adulto'],
    })
  })

  it('sem categoria da disputa que sirva, recusa apontando a tabela — também para a diretoria', async () => {
    const c = await competicao('Taikai Só Juvenil', [{ nome: 'Juvenil', idadeMaxima: '17' }])

    const resposta = await inscrever(c, {
      praticanteId: mukyuId, [`individual_${c.subeventoId}`]: c.categorias.Juvenil!,
    }, diretoria)
    expect(resposta.problemas[0]).toContain('tabela de categorias')
  })

  it('trocar de categoria atualiza a inscrição; só é gratuita se todas forem isentas', async () => {
    const c = await competicao('Taikai Da Troca', TABELA)
    const individual = `individual_${c.subeventoId}`
    const equipe = `equipe_${c.subeventoId}`
    const total = async () =>
      (await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)).dados.inscricao?.total

    await inscrever(c, { [individual]: c.categorias.Adulto! })
    expect(await total()).toBe(50)

    // Valor da competição é 50, mas Feminino dan é isenta.
    await inscrever(c, { [individual]: c.categorias['Feminino dan']! })
    expect(await total()).toBe(0)

    // Equipe adulto não é isenta: a participação passa a ser paga.
    await inscrever(c, { [individual]: c.categorias['Feminino dan']!, [equipe]: c.categorias['Equipe adulto']! })
    expect(await total()).toBe(50)
  })
})

describe('lista de inscritos e mudanças na tabela', () => {
  it('mostra as categorias e avisa quem deixou de caber nelas', async () => {
    const c = await competicao('Taikai Da Tabela Que Mudou', TABELA)
    await inscrever(c, { [`individual_${c.subeventoId}`]: c.categorias.Adulto! })

    const antes = await ler<InscritosDoEvento>(`/api/eventos/${c.evento.id}/inscritos`, diretoria)
    expect(antes.dados.inscritos[0]!.foraDaCategoria).toEqual([])

    // A diretoria corrige a tabela depois: Adulto passa a ser de 50 anos em diante.
    await categoria(c.subeventoId, {
      id: c.categorias.Adulto!, nome: 'Adulto', idadeMinima: '50',
    })

    const depois = await ler<InscritosDoEvento>(`/api/eventos/${c.evento.id}/inscritos`, diretoria)
    expect(depois.dados.inscritos[0]!.competicoes[c.subeventoId]).toEqual({
      categoriaIndividualId: c.categorias.Adulto, categoriaEquipeId: null,
    })
    expect(depois.dados.inscritos[0]!.foraDaCategoria).toEqual([c.subeventoId])
  })

  it('avisa também quando é a categoria de equipe que deixou de servir', async () => {
    const c = await competicao('Taikai Da Equipe Que Mudou', TABELA)
    await inscrever(c, { [`equipe_${c.subeventoId}`]: c.categorias['Equipe adulto']! })

    await categoria(c.subeventoId, {
      id: c.categorias['Equipe adulto']!, nome: 'Equipe adulto', idadeMinima: '50',
    })

    const { dados } = await ler<InscritosDoEvento>(`/api/eventos/${c.evento.id}/inscritos`, diretoria)
    expect(dados.inscritos[0]!.foraDaCategoria).toEqual([c.subeventoId])
  })

  it('remover categoria tira só aquela disputa; sem nenhuma, a pessoa sai da competição', async () => {
    const c = await competicao('Taikai Da Categoria Removida', TABELA)
    await inscrever(c, {
      [`individual_${c.subeventoId}`]: c.categorias.Adulto!,
      [`equipe_${c.subeventoId}`]: c.categorias['Equipe adulto']!,
      [`obento_${daqui(20)}`]: '2',
    })

    const sem = await enviar('/api/eventos/categorias/remover', { id: c.categorias.Adulto! },
      { cookie: diretoria })
    expect(sem.problemas[0]).toContain('1 inscrito')

    await enviar('/api/eventos/categorias/remover', { id: c.categorias.Adulto!, confirmar: 'on' },
      { cookie: diretoria })

    const meio = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)
    expect(meio.dados.subeventos[0]!.categorias.map(x => x.nome)).not.toContain('Adulto')
    expect(meio.dados.inscricao?.competicoes[c.subeventoId]).toEqual({
      categoriaIndividualId: null, categoriaEquipeId: c.categorias['Equipe adulto'],
    })

    await enviar('/api/eventos/categorias/remover', { id: c.categorias['Equipe adulto']!, confirmar: 'on' },
      { cookie: diretoria })

    const { dados } = await ler<EventoDetalhado>(`/api/eventos/${c.evento.slug}`, kenshi)
    expect(dados.inscricao).toMatchObject({ subeventoIds: [], obentos: { [daqui(20)]: 2 } })
  })
})

describe('telas', () => {
  async function html(caminho: string, cookie: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: { cookie } })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('a inscrição oferece só as categorias que servem, com os nomes que o servidor lê', async () => {
    const c = await competicao('Taikai Na Tela Da Kenshi', TABELA)
    const { texto } = await html(`/agenda/${c.evento.slug}`, kenshi)

    // Duas individuais servem: lista para escolher. Uma de equipe: caixa de marcar.
    expect(texto).toContain(`name="individual_${c.subeventoId}"`)
    expect(texto).toContain(`name="equipe_${c.subeventoId}"`)
    expect(texto).not.toContain(`name="categoria_${c.subeventoId}"`)
    expect(texto).toContain(`value="${c.categorias['Feminino dan']}"`)
    expect(texto).toContain(`value="${c.categorias['Equipe adulto']}"`)
    // Juvenil não serve a ela, nas duas disputas.
    expect(texto).not.toContain(`value="${c.categorias.Juvenil}"`)
    expect(texto).not.toContain(`value="${c.categorias['Equipe juvenil']}"`)
  })

  it('a tela de edição traz a tabela, separada por disputa', async () => {
    const c = await competicao('Taikai Na Tela Da Diretoria', TABELA)
    const { status, texto } = await html(`/eventos/${c.evento.id}`, diretoria)

    expect(status).toBe(200)
    expect(texto).toContain('action="/api/eventos/categorias"')
    expect(texto).toContain('action="/api/eventos/categorias/remover"')
    expect(texto).toContain('name="grauMinimo"')
    expect(texto).toContain('value="INDIVIDUAL"')
    expect(texto).toContain('value="EQUIPE"')
  })
})
