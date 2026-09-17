import { beforeAll, describe, expect, it } from 'vitest'
import type { EventoDetalhado, InscritosDoEvento } from '../../shared/evento'
import { ENDERECO, comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

/**
 * Eventos e inscrições (etapa 7.1).
 *
 * Os dias são relativos a hoje, para o prazo estar aberto ou fechado sem
 * depender de quando o teste roda. Nomes de modalidade próprios, porque o banco
 * é compartilhado com os outros arquivos.
 */

let diretoria = ''
let praticante = ''
let praticanteId = ''
let semAcessoId = ''
const modalidades = { kendo: '', iaido: '' }

function daqui(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

async function criarEvento(titulo: string, extra: Record<string, string> = {}) {
  const resposta = await enviar('/api/eventos', {
    titulo,
    descricao: `Descrição de ${titulo}.`,
    prazoInscricao: daqui(10),
    visibilidade: 'PUBLICA',
    ...extra,
  }, { cookie: diretoria })

  if (!resposta.ok) throw new Error(`${titulo}: ${resposta.problemas.join('; ')}`)
  return resposta.destino.split('/').pop()!
}

function seminario(eventoId: string, extra: Record<string, string> = {}) {
  return enviar('/api/eventos/subeventos', {
    eventoId,
    tipo: 'SEMINARIO',
    modalidadeId: modalidades.kendo,
    local: 'Ginásio do clube',
    dia_1: daqui(20),
    valor: '80,00',
    ...extra,
  }, { cookie: diretoria })
}

async function detalhe(id: string, cookie?: string, query = '') {
  return ler<EventoDetalhado>(`/api/eventos/${id}${query}`, cookie)
}

/** Evento publicado com seminário de kendo e de iaido, alojamento e obento. */
async function eventoCompleto(titulo: string, extra: Record<string, string> = {}) {
  const id = await criarEvento(titulo, extra)
  await seminario(id, { dia_1: daqui(20), dia_2: daqui(21) })
  await seminario(id, { modalidadeId: modalidades.iaido, dia_1: daqui(21), valor: '0' })

  const configurado = await enviar('/api/eventos', {
    id,
    titulo,
    descricao: `Descrição de ${titulo}.`,
    prazoInscricao: extra.prazoInscricao ?? daqui(10),
    visibilidade: extra.visibilidade ?? 'PUBLICA',
    ofereceAlojamento: 'on',
    valorAlojamento: '120',
    enderecoAlojamento: 'Rua do Dojo, 10',
    valorObento: '25,50',
    [`obento_${daqui(20)}`]: 'on',
    [`obento_${daqui(21)}`]: 'on',
  }, { cookie: diretoria })
  if (!configurado.ok) throw new Error(configurado.problemas.join('; '))

  await enviar('/api/eventos/publicar', { id }, { cookie: diretoria })

  const { dados } = await detalhe(id, diretoria)
  return dados
}

function inscrever(evento: EventoDetalhado, campos: Record<string, string>, cookie = praticante,
  opcoes: { nativo?: boolean } = {}) {
  return enviar('/api/eventos/inscricao', { eventoId: evento.id, ...campos },
    { cookie, nativo: opcoes.nativo })
}

const subeventoDe = (evento: EventoDetalhado, modalidadeId: string) =>
  evento.subeventos.find(s => s.modalidade.id === modalidadeId)!

beforeAll(async () => {
  diretoria = await comoDiretoria()

  for (const [chave, nome] of [['kendo', 'Kendo Eventos'], ['iaido', 'Iaido Eventos']] as const) {
    await enviar('/api/modalidades', { nome, kyuInicial: '6', ativa: 'on' }, { cookie: diretoria })
    const { dados } = await ler<Array<{ id: string, nome: string }>>('/api/modalidades', diretoria)
    modalidades[chave] = dados.find(m => m.nome === nome)!.id
  }

  const criado = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Inscrita Com Acesso', documento: gerarCpf(5001), email: 'e5001@teste.local',
    sexo: 'FEMININO',
  }), { cookie: diretoria })
  praticanteId = criado.destino.split('/').pop()!

  const acesso = await enviar(`/api/praticantes/${praticanteId}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''
  await enviar('/api/auth/redefinir-senha', {
    token, senha: 'senha da inscrita', confirmacao: 'senha da inscrita',
  })
  praticante = await entrar('e5001@teste.local', 'senha da inscrita')

  // Criança sem conta, e já desligada do clube: só a diretoria a inscreve, e a
  // lista precisa mostrar que não está filiada.
  const semAcesso = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Aluno Sem Conta', documento: gerarCpf(5002), email: 'e5002@teste.local',
  }), { cookie: diretoria })
  semAcessoId = semAcesso.destino.split('/').pop()!

  const { dados: ficha } = await ler<{ filiacoes: Array<{ id: string }> }>(
    `/api/praticantes/${semAcessoId}`, diretoria)
  await enviar(`/api/praticantes/${semAcessoId}/filiacoes`, {
    acao: 'encerrar', filiacaoId: ficha.filiacoes[0]!.id, fimEm: daqui(-1),
  }, { cookie: diretoria })
}, 180_000)

describe('montagem do evento', () => {
  it('não publica evento sem subevento com data', async () => {
    const id = await criarEvento('Evento Sem Programação')
    const resposta = await enviar('/api/eventos/publicar', { id }, { cookie: diretoria })

    expect(resposta.problemas[0]).toContain('subevento com data')
  })

  it('tira início e fim dos dias dos subeventos', async () => {
    const id = await criarEvento('Evento De Dois Dias')
    await seminario(id, { dia_1: daqui(22), dia_2: daqui(20) })
    await seminario(id, { modalidadeId: modalidades.iaido, dia_1: daqui(25) })

    const { dados } = await detalhe(id, diretoria)
    expect(dados.inicio).toBe(daqui(20))
    expect(dados.fim).toBe(daqui(25))
    expect(dados.diasDoEvento).toEqual([daqui(20), daqui(22), daqui(25)])
  })

  it('aceita o mesmo tipo em outra modalidade, mas não na mesma', async () => {
    const id = await criarEvento('Evento Com Seminário Repetido')
    expect((await seminario(id)).ok).toBe(true)
    expect((await seminario(id, { modalidadeId: modalidades.iaido })).ok).toBe(true)

    const repetido = await seminario(id, { dia_1: daqui(30) })
    expect(repetido.problemas[0]).toContain('já tem seminário de Kendo Eventos')
  })

  it('distingue seminário gratuito de valor em branco', async () => {
    const id = await criarEvento('Evento Com Seminário Gratuito')
    expect((await seminario(id, { valor: '0' })).ok).toBe(true)
    expect((await seminario(id, { modalidadeId: modalidades.iaido, valor: '' })).problemas[0])
      .toContain('Use 0')
  })

  it('ainda não aceita exame', async () => {
    const id = await criarEvento('Evento Com Exame Antecipado')
    const resposta = await seminario(id, { tipo: 'EXAME' })
    expect(resposta.problemas).toHaveLength(1)
  })

  it('recusa prazo depois do primeiro dia do evento', async () => {
    const id = await criarEvento('Evento Com Prazo Atrasado')
    await seminario(id, { dia_1: daqui(20) })

    const resposta = await enviar('/api/eventos', {
      id, titulo: 'Evento Com Prazo Atrasado', descricao: 'x', prazoInscricao: daqui(21),
    }, { cookie: diretoria })
    expect(resposta.problemas[0]).toContain('primeiro dia')
  })

  it('recusa subevento que começaria antes do prazo', async () => {
    const id = await criarEvento('Evento Com Subevento Adiantado', { prazoInscricao: daqui(10) })
    const resposta = await seminario(id, { dia_1: daqui(5) })
    expect(resposta.problemas[0]).toContain('Ajuste o prazo')
  })

  it('só oferece obento em dia que tem subevento', async () => {
    const id = await criarEvento('Evento Com Obento Fora Do Dia')
    await seminario(id, { dia_1: daqui(20) })

    const resposta = await enviar('/api/eventos', {
      id, titulo: 'Evento Com Obento Fora Do Dia', descricao: 'x', prazoInscricao: daqui(10),
      valorObento: '20', [`obento_${daqui(23)}`]: 'on',
    }, { cookie: diretoria })
    expect(resposta.problemas[0]).toContain('dia que tenha subevento')
  })

  it('praticante não cria evento', async () => {
    const resposta = await enviar('/api/eventos', {
      titulo: 'Evento Da Praticante', descricao: 'x', prazoInscricao: daqui(10),
    }, { cookie: praticante })
    expect(resposta.status).toBe(403)
  })
})

describe('visibilidade', () => {
  it('visitante vê evento público publicado, e não rascunho nem interno', async () => {
    const publico = await eventoCompleto('Taikai Aberto')
    const interno = await eventoCompleto('Treino Interno', { visibilidade: 'RESTRITA' })
    const rascunho = await criarEvento('Evento Ainda Rascunho')

    expect((await detalhe(publico.slug)).status).toBe(200)
    expect((await detalhe(interno.slug)).status).toBe(404)
    expect((await detalhe(rascunho)).status).toBe(404)

    const { dados } = await ler<{ eventos: Array<{ titulo: string }> }>('/api/eventos')
    const titulos = dados.eventos.map(e => e.titulo)
    expect(titulos).toContain('Taikai Aberto')
    expect(titulos).not.toContain('Treino Interno')
    expect(titulos).not.toContain('Evento Ainda Rascunho')
  })

  it('a página do evento interno responde 404 para visitante', async () => {
    const interno = await eventoCompleto('Seminário Só Do Clube', { visibilidade: 'RESTRITA' })
    expect((await ler(`/agenda/${interno.slug}`)).status).toBe(404)
    expect((await detalhe(interno.slug, praticante)).status).toBe(200)
  })
})

describe('inscrição da praticante', () => {
  it('inscreve em seminário, com alojamento e obento, e mostra o total estimado', async () => {
    const evento = await eventoCompleto('Gasshuku De Inverno')
    const kendo = subeventoDe(evento, modalidades.kendo)

    const resposta = await inscrever(evento, {
      [`subevento_${kendo.id}`]: 'on',
      alojamento: 'on',
      [`obento_${daqui(20)}`]: '2',
      [`obento_${daqui(21)}`]: '1',
    })
    expect(resposta.ok).toBe(true)

    const { dados } = await detalhe(evento.slug, praticante)
    expect(dados.inscricao).toMatchObject({
      subeventoIds: [kendo.id],
      alojamento: true,
      obentos: { [daqui(20)]: 2, [daqui(21)]: 1 },
    })
    // 80 do seminário + 120 do alojamento + 3 × 25,50.
    expect(dados.inscricao!.total).toBe(276.5)
  })

  it('aceita inscrição só com obento, e desmarca alojamento de quem não participa', async () => {
    const evento = await eventoCompleto('Taikai Com Torcida')

    await inscrever(evento, { alojamento: 'on', [`obento_${daqui(21)}`]: '3' })

    const { dados } = await detalhe(evento.slug, praticante)
    expect(dados.inscricao).toMatchObject({ subeventoIds: [], alojamento: false })
    expect(dados.inscricao!.obentos).toEqual({ [daqui(21)]: 3 })
  })

  it('desmarcar tudo é desistir', async () => {
    const evento = await eventoCompleto('Seminário Com Desistência')
    const kendo = subeventoDe(evento, modalidades.kendo)

    await inscrever(evento, { [`subevento_${kendo.id}`]: 'on' })
    expect((await detalhe(evento.slug, praticante)).dados.inscricao).not.toBeNull()

    await inscrever(evento, { [`obento_${daqui(20)}`]: '0' })
    expect((await detalhe(evento.slug, praticante)).dados.inscricao).toBeNull()
  })

  it('depois do prazo a praticante não mexe, e a diretoria sim', async () => {
    const evento = await eventoCompleto('Taikai Com Prazo Vencido', { prazoInscricao: daqui(-2) })
    const kendo = subeventoDe(evento, modalidades.kendo)
    expect(evento.prazoAberto).toBe(false)

    const recusada = await inscrever(evento, { [`subevento_${kendo.id}`]: 'on' })
    expect(recusada.problemas[0]).toContain('encerraram')

    const pelaDiretoria = await inscrever(evento, {
      praticanteId, [`subevento_${kendo.id}`]: 'on',
    }, diretoria)
    expect(pelaDiretoria.ok).toBe(true)
    expect((await detalhe(evento.slug, praticante)).dados.inscricao?.subeventoIds).toEqual([kendo.id])
  })

  it('praticante não inscreve outra pessoa', async () => {
    const evento = await eventoCompleto('Seminário Sem Procuração')
    const kendo = subeventoDe(evento, modalidades.kendo)

    const resposta = await inscrever(evento, {
      praticanteId: semAcessoId, [`subevento_${kendo.id}`]: 'on',
    })
    expect(resposta.status).toBe(403)
  })

  it('praticante não enxerga a inscrição de outra pessoa pela query', async () => {
    const evento = await eventoCompleto('Seminário Com Curiosidade')
    const { dados } = await detalhe(evento.slug, praticante, `?praticante=${semAcessoId}`)
    expect(dados.inscrevendo?.praticanteId).toBe(praticanteId)
  })

  it('recusa obento em dia sem oferta, mas não limita a quantidade', async () => {
    const evento = await eventoCompleto('Taikai Com Muito Obento')

    expect((await inscrever(evento, { [`obento_${daqui(22)}`]: '1' })).problemas[0])
      .toContain('oferta')

    expect((await inscrever(evento, { [`obento_${daqui(20)}`]: '120' })).ok).toBe(true)
    expect((await detalhe(evento.slug, praticante)).dados.inscricao?.obentos)
      .toEqual({ [daqui(20)]: 120 })
  })

  it('recusa subevento de outro evento', async () => {
    const um = await eventoCompleto('Evento Um')
    const outro = await eventoCompleto('Evento Outro')
    const alheio = subeventoDe(outro, modalidades.kendo)

    const resposta = await inscrever(um, { [`subevento_${alheio.id}`]: 'on' })
    expect(resposta.problemas).toHaveLength(1)
  })

  it('aceita o envio nativo, sem JavaScript', async () => {
    const evento = await eventoCompleto('Seminário Sem Script')
    const kendo = subeventoDe(evento, modalidades.kendo)

    const resposta = await inscrever(evento, { [`subevento_${kendo.id}`]: 'on' }, praticante,
      { nativo: true })

    expect(resposta.status).toBe(303)
    expect(resposta.destino).toBe(`/agenda/${evento.slug}`)
  })

  it('visitante não se inscreve', async () => {
    const evento = await eventoCompleto('Seminário Para Quem Entrou')
    const resposta = await enviar('/api/eventos/inscricao', { eventoId: evento.id })
    expect(resposta.status).toBe(401)
  })
})

describe('diretoria inscrevendo outra pessoa', () => {
  it('inscreve praticante sem conta e volta para a página dele', async () => {
    const evento = await eventoCompleto('Taikai Infantil')
    const iaido = subeventoDe(evento, modalidades.iaido)

    const resposta = await inscrever(evento, {
      praticanteId: semAcessoId, [`subevento_${iaido.id}`]: 'on',
    }, diretoria, { nativo: true })
    expect(resposta.destino).toBe(`/agenda/${evento.slug}?praticante=${semAcessoId}`)

    const { dados } = await detalhe(evento.slug, diretoria, `?praticante=${semAcessoId}`)
    expect(dados.inscrevendo).toMatchObject({ praticanteId: semAcessoId, proprio: false })
    expect(dados.inscricao?.subeventoIds).toEqual([iaido.id])
  })

  it('erro de inscrição de outra pessoa volta com as duas partes da query', async () => {
    const evento = await eventoCompleto('Taikai Com Erro Na Volta')
    const resposta = await inscrever(evento, {
      praticanteId: semAcessoId, [`obento_${daqui(22)}`]: '1',
    }, diretoria, { nativo: true })

    expect(resposta.destino).toMatch(new RegExp(`\\?praticante=${semAcessoId}&erros=`))
  })

  it('a lista de inscritos mostra filiação, obentos por dia e total', async () => {
    const evento = await eventoCompleto('Taikai Com Lista')
    const kendo = subeventoDe(evento, modalidades.kendo)
    const iaido = subeventoDe(evento, modalidades.iaido)

    await inscrever(evento, {
      [`subevento_${kendo.id}`]: 'on', alojamento: 'on', [`obento_${daqui(20)}`]: '2',
    })
    await inscrever(evento, {
      praticanteId: semAcessoId, [`subevento_${iaido.id}`]: 'on', [`obento_${daqui(20)}`]: '1',
    }, diretoria)

    const { dados } = await ler<InscritosDoEvento>(`/api/eventos/${evento.id}/inscritos`, diretoria)

    expect(dados.inscritos.map(i => [i.nome, i.filiado])).toEqual([
      ['Aluno Sem Conta', false],
      ['Inscrita Com Acesso', true],
    ])
    expect(dados.totaisDeObento).toEqual({ [daqui(20)]: 3 })
    expect(dados.comAlojamento).toBe(1)
    // 80 + 120 + 2 × 25,50 da primeira; 0 + 25,50 da segunda.
    expect(dados.total).toBe(276.5)
  })

  it('praticante não vê a lista de inscritos', async () => {
    const evento = await eventoCompleto('Taikai Com Lista Fechada')
    expect((await ler(`/api/eventos/${evento.id}/inscritos`, praticante)).status).toBe(403)
  })
})

describe('mudanças que apagam o que já foi escolhido', () => {
  it('tirar a oferta de obento de um dia pede confirmação e apaga as encomendas', async () => {
    const evento = await eventoCompleto('Taikai Que Perde Um Obento')
    await inscrever(evento, { [`obento_${daqui(20)}`]: '4' })

    const semObento = {
      id: evento.id, titulo: evento.titulo, descricao: evento.descricao,
      prazoInscricao: evento.prazoInscricao, ofereceAlojamento: 'on', valorAlojamento: '120',
      enderecoAlojamento: 'Rua do Dojo, 10', valorObento: '25,50', [`obento_${daqui(21)}`]: 'on',
    }

    const sem = await enviar('/api/eventos', semObento, { cookie: diretoria })
    expect(sem.problemas[0]).toContain('apaga 4 obento(s)')
    expect((await detalhe(evento.slug, praticante)).dados.inscricao).not.toBeNull()

    const com = await enviar('/api/eventos', { ...semObento, confirmarApagarObentos: 'on' },
      { cookie: diretoria })
    expect(com.ok).toBe(true)

    // Ela tinha só obento naquele dia: a inscrição inteira some.
    expect((await detalhe(evento.slug, praticante)).dados.inscricao).toBeNull()
  })

  it('remover subevento com inscritos pede confirmação e desmarca o alojamento', async () => {
    const evento = await eventoCompleto('Taikai Que Perde O Iaido')
    const iaido = subeventoDe(evento, modalidades.iaido)

    await inscrever(evento, {
      [`subevento_${iaido.id}`]: 'on', alojamento: 'on', [`obento_${daqui(20)}`]: '1',
    })

    const sem = await enviar('/api/eventos/subeventos/remover', { id: iaido.id }, { cookie: diretoria })
    expect(sem.problemas[0]).toContain('1 inscrição')

    await enviar('/api/eventos/subeventos/remover', { id: iaido.id, confirmar: 'on' },
      { cookie: diretoria })

    const { dados } = await detalhe(evento.slug, praticante)
    expect(dados.subeventos.map(s => s.id)).not.toContain(iaido.id)
    // Continua inscrita pelo obento, mas sem alojamento: não participa de nada.
    expect(dados.inscricao).toMatchObject({ subeventoIds: [], alojamento: false })
  })

  it('deixar de oferecer alojamento desmarca quem tinha pedido', async () => {
    const evento = await eventoCompleto('Taikai Sem Alojamento')
    const kendo = subeventoDe(evento, modalidades.kendo)
    await inscrever(evento, { [`subevento_${kendo.id}`]: 'on', alojamento: 'on' })

    await enviar('/api/eventos', {
      id: evento.id, titulo: evento.titulo, descricao: evento.descricao,
      prazoInscricao: evento.prazoInscricao, valorObento: '25,50',
      [`obento_${daqui(20)}`]: 'on', [`obento_${daqui(21)}`]: 'on',
    }, { cookie: diretoria })

    expect((await detalhe(evento.slug, praticante)).dados.inscricao?.alojamento).toBe(false)
  })
})

describe('telas', () => {
  async function html(caminho: string, cookie?: string) {
    const resposta = await fetch(`${ENDERECO}${caminho}`, { headers: cookie ? { cookie } : {} })
    return { status: resposta.status, texto: await resposta.text() }
  }

  it('a página do evento traz o formulário de inscrição com os nomes que o servidor lê', async () => {
    const evento = await eventoCompleto('Taikai Na Tela')
    const kendo = subeventoDe(evento, modalidades.kendo)
    const { status, texto } = await html(`/agenda/${evento.slug}`, praticante)

    expect(status).toBe(200)
    expect(texto).toContain('action="/api/eventos/inscricao"')
    expect(texto).toContain(`name="subevento_${kendo.id}"`)
    expect(texto).toContain('name="alojamento"')
    expect(texto).toContain(`name="obento_${daqui(20)}"`)
    // Praticante não recebe o seletor de quem inscrever.
    expect(texto).not.toContain('name="praticante"')
  })

  it('a diretoria vê o seletor, com o praticante escolhido marcado', async () => {
    const evento = await eventoCompleto('Taikai Com Seletor')
    const { texto } = await html(`/agenda/${evento.slug}?praticante=${semAcessoId}`, diretoria)

    expect(texto).toContain('name="praticante"')
    expect(texto).toMatch(new RegExp(`value="${semAcessoId}"[^>]*selected`))
    expect(texto).toContain(`name="praticanteId" value="${semAcessoId}"`)
  })

  it('a tela de edição traz os formulários de evento, subevento e obento', async () => {
    const evento = await eventoCompleto('Taikai Em Edição')
    const { status, texto } = await html(`/eventos/${evento.id}`, diretoria)

    expect(status).toBe(200)
    expect(texto).toContain('action="/api/eventos"')
    expect(texto).toContain('action="/api/eventos/subeventos"')
    expect(texto).toContain('action="/api/eventos/subeventos/remover"')
    expect(texto).toContain('name="dia_1"')
    expect(texto).toContain(`name="obento_${daqui(21)}"`)
  })

  it('a lista de inscritos abre para a diretoria', async () => {
    const evento = await eventoCompleto('Taikai Com Tabela')
    const { status, texto } = await html(`/eventos/${evento.id}/inscritos`, diretoria)

    expect(status).toBe(200)
    expect(texto).toContain('Obentos a encomendar')
  })
})
