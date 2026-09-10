import { beforeAll, describe, expect, it } from 'vitest'
import {
  comoDiretoria,
  dadosDePraticante,
  entrar,
  enviar,
  enviarArquivo,
  gerarCpf,
  ler,
  lerBruto,
} from './ajudantes'

/**
 * Visibilidade do newsfeed — a fronteira mais perigosa do sistema.
 *
 * Errar aqui não é inconveniente: é publicar na internet um post que o clube
 * marcou como interno. Por isso cada combinação de leitor e publicação tem
 * teste próprio, incluindo o acesso direto pelo endereço.
 */

let diretoria = ''
let praticante = ''
const slugs: Record<string, string> = {}

async function criar(titulo: string, visibilidade: string, publicar: boolean) {
  const criada = await enviar('/api/publicacoes', {
    titulo, conteudo: `Conteúdo de ${titulo}.`, visibilidade,
  }, { cookie: diretoria })

  const id = criada.destino.split('/').pop()!
  if (publicar) await enviar('/api/publicacoes/publicar', { id }, { cookie: diretoria })

  const { dados } = await ler<{ slug: string }>(`/api/publicacoes/${id}`, diretoria)
  return { id, slug: dados.slug }
}

/** Arquivo com assinatura de PNG de verdade; o recheio não importa. */
function imagemPng() {
  const bytes = new Uint8Array(256)
  bytes.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  return { nome: 'foto.png', tipo: 'image/png', bytes }
}

async function enderecoDaCapa(id: string) {
  const { dados } = await ler<{ imagemCapa: string | null }>(`/api/publicacoes/${id}`, diretoria)
  return dados.imagemCapa
}

beforeAll(async () => {
  diretoria = await comoDiretoria()

  const criado = await enviar('/api/praticantes', dadosDePraticante({
    nomeCompleto: 'Leitor Autenticado',
    documento: gerarCpf(4001),
    email: 'leitor@teste.local',
  }), { cookie: diretoria })

  const praticanteId = criado.destino.split('/').pop()!
  const acesso = await enviar(`/api/praticantes/${praticanteId}/acesso`, {}, { cookie: diretoria })
  const token = decodeURIComponent(acesso.destino.split('acessoLink=')[1] ?? '').split('t=')[1] ?? ''

  await enviar('/api/auth/redefinir-senha', {
    token, senha: 'senha do leitor', confirmacao: 'senha do leitor',
  })
  praticante = await entrar('leitor@teste.local', 'senha do leitor')

  slugs.publica = (await criar('Aviso Público Publicado', 'PUBLICA', true)).slug
  slugs.restrita = (await criar('Aviso Interno Publicado', 'RESTRITA', true)).slug
  slugs.rascunhoPublico = (await criar('Rascunho Público', 'PUBLICA', false)).slug
  slugs.rascunhoInterno = (await criar('Rascunho Interno', 'RESTRITA', false)).slug
}, 180_000)

async function tituloDoFeed(cookie?: string) {
  const { dados } = await ler<{ publicacoes: Array<{ titulo: string }> }>('/api/publicacoes', cookie)
  return dados.publicacoes.map(p => p.titulo)
}

describe('visitante anônimo', () => {
  it('vê apenas a publicação pública já publicada', async () => {
    const titulos = await tituloDoFeed()

    expect(titulos).toContain('Aviso Público Publicado')
    expect(titulos).not.toContain('Aviso Interno Publicado')
    expect(titulos).not.toContain('Rascunho Público')
    expect(titulos).not.toContain('Rascunho Interno')
  })

  it('lê a publicação pública pelo endereço', async () => {
    const { status } = await ler(`/api/publicacoes/${slugs.publica}`)
    expect(status).toBe(200)
  })

  it('recebe 404 no endereço de publicação interna', async () => {
    // 404, e não 403: dizer "proibido" confirmaria que existe um post interno
    // naquele endereço.
    const { status } = await ler(`/api/publicacoes/${slugs.restrita}`)
    expect(status).toBe(404)
  })

  it('recebe 404 em rascunho, mesmo público', async () => {
    const { status } = await ler(`/api/publicacoes/${slugs.rascunhoPublico}`)
    expect(status).toBe(404)
  })

  it('a página da publicação interna responde 404, e não 200 vazio', async () => {
    // A API já devolvia 404, mas a página respondia 200 com o corpo vazio —
    // nada vazava, e ainda assim um buscador indexaria aquilo como válido.
    const { status } = await ler(`/noticias/${slugs.restrita}`)
    expect(status).toBe(404)
  })

  it('não recebe o conteúdo de publicação que não pode ver', async () => {
    const { dados } = await ler<{ publicacoes: Array<Record<string, unknown>> }>('/api/publicacoes')
    const serializado = JSON.stringify(dados)

    expect(serializado).not.toContain('Aviso Interno')
    expect(serializado).not.toContain('Rascunho')
  })
})

describe('praticante autenticado', () => {
  it('vê a pública e a interna, mas nenhum rascunho', async () => {
    const titulos = await tituloDoFeed(praticante)

    expect(titulos).toContain('Aviso Público Publicado')
    expect(titulos).toContain('Aviso Interno Publicado')
    expect(titulos).not.toContain('Rascunho Público')
    expect(titulos).not.toContain('Rascunho Interno')
  })

  it('lê a publicação interna pelo endereço', async () => {
    const { status } = await ler(`/api/publicacoes/${slugs.restrita}`, praticante)
    expect(status).toBe(200)
  })

  it('continua sem alcançar rascunho', async () => {
    const { status } = await ler(`/api/publicacoes/${slugs.rascunhoInterno}`, praticante)
    expect(status).toBe(404)
  })

  it('não cria publicação', async () => {
    const { status } = await enviar('/api/publicacoes', {
      titulo: 'Post do praticante', conteudo: 'não deveria existir',
    }, { cookie: praticante })

    expect(status).toBe(403)
  })

  it('não publica rascunho alheio', async () => {
    const { dados } = await ler<{ publicacoes: Array<{ id: string, titulo: string }> }>(
      '/api/publicacoes', diretoria)
    const rascunho = dados.publicacoes.find(p => p.titulo === 'Rascunho Interno')!

    const { status } = await enviar('/api/publicacoes/publicar', { id: rascunho.id },
      { cookie: praticante })
    expect(status).toBe(403)
  })
})

describe('diretoria', () => {
  it('enxerga tudo, inclusive rascunho', async () => {
    const titulos = await tituloDoFeed(diretoria)

    expect(titulos).toEqual(expect.arrayContaining([
      'Aviso Público Publicado', 'Aviso Interno Publicado',
      'Rascunho Público', 'Rascunho Interno',
    ]))
  })

  it('despublicar tira a publicação do feed público', async () => {
    const { dados } = await ler<{ publicacoes: Array<{ id: string, titulo: string }> }>(
      '/api/publicacoes', diretoria)
    const publicada = dados.publicacoes.find(p => p.titulo === 'Aviso Público Publicado')!

    await enviar('/api/publicacoes/publicar', { id: publicada.id, acao: 'despublicar' },
      { cookie: diretoria })
    expect(await tituloDoFeed()).not.toContain('Aviso Público Publicado')

    await enviar('/api/publicacoes/publicar', { id: publicada.id }, { cookie: diretoria })
    expect(await tituloDoFeed()).toContain('Aviso Público Publicado')
  })
})

describe('escrita da publicação', () => {
  it('exige título e conteúdo', async () => {
    const resposta = await enviar('/api/publicacoes', { titulo: '', conteudo: '' },
      { cookie: diretoria })

    expect(resposta.problemas).toHaveLength(2)
  })

  it('gera endereço a partir do título, sem acento', async () => {
    const { slug } = await criar('Exame de graduação em março', 'PUBLICA', true)
    expect(slug).toBe('exame-de-graduacao-em-marco')
  })

  it('não repete endereço quando o título se repete', async () => {
    const primeira = await criar('Treino de sábado', 'PUBLICA', true)
    const segunda = await criar('Treino de sábado', 'PUBLICA', true)

    expect(primeira.slug).toBe('treino-de-sabado')
    expect(segunda.slug).toBe('treino-de-sabado-2')
  })

  it('não apaga a capa ao salvar o texto', async () => {
    // O formulário de texto não manda o campo da capa. Enquanto ele escrevia
    // essa coluna, corrigir uma vírgula no título deixava o post sem imagem.
    const post = await criar('Post que será reeditado', 'PUBLICA', true)
    await enviarArquivo('/api/publicacoes/capa', { id: post.id }, imagemPng(),
      { cookie: diretoria })

    await enviar('/api/publicacoes', {
      titulo: 'Post que será reeditado, agora corrigido',
      conteudo: 'Outro texto.',
      visibilidade: 'PUBLICA',
      id: post.id,
    }, { cookie: diretoria })

    const { dados } = await ler<{ imagemCapa: string | null }>(
      `/api/publicacoes/${post.id}`, diretoria)
    expect(dados.imagemCapa).not.toBeNull()
  })

  it('escapa HTML escrito no conteúdo', async () => {
    // Markdown roda com html desligado: script escrito no corpo do post vira
    // texto na página, não script.
    const criada = await enviar('/api/publicacoes', {
      titulo: 'Post com marcação',
      conteudo: 'Antes <script>alert(1)</script> depois',
      visibilidade: 'PUBLICA',
    }, { cookie: diretoria })

    const id = criada.destino.split('/').pop()!
    await enviar('/api/publicacoes/publicar', { id }, { cookie: diretoria })

    const { dados } = await ler<{ html: string }>(`/api/publicacoes/${id}`, diretoria)

    expect(dados.html).not.toContain('<script>')
    expect(dados.html).toContain('&lt;script&gt;')
  })
})

/**
 * A capa herda a permissão do post.
 *
 * É o detalhe que quase passa batido: proteger o texto e deixar a foto em uma
 * pasta pública faz o post interno vazar pela imagem.
 */
describe('imagem de capa', () => {
  let publica = { id: '', slug: '' }
  let interna = { id: '', slug: '' }
  let rascunho = { id: '', slug: '' }
  let capaPublica = ''
  let capaInterna = ''
  let capaRascunho = ''

  beforeAll(async () => {
    publica = await criar('Notícia Ilustrada', 'PUBLICA', true)
    interna = await criar('Notícia Ilustrada Interna', 'RESTRITA', true)
    rascunho = await criar('Rascunho Ilustrado', 'PUBLICA', false)

    for (const post of [publica, interna, rascunho]) {
      await enviarArquivo('/api/publicacoes/capa', { id: post.id }, imagemPng(),
        { cookie: diretoria })
    }

    capaPublica = (await enderecoDaCapa(publica.id))!
    capaInterna = (await enderecoDaCapa(interna.id))!
    capaRascunho = (await enderecoDaCapa(rascunho.id))!
  }, 60_000)

  it('guarda o arquivo com nome sorteado e devolve o endereço pronto', () => {
    // O nome do arquivo enviado ("foto.png") não aparece: o que vai para o
    // disco é sorteado aqui dentro.
    expect(capaPublica).toMatch(/^\/api\/publicacoes\/[\w-]+\/capa\/[a-f0-9]{32}\.png$/)
    expect(capaPublica).not.toContain('foto')
  })

  it('entrega a capa pública para visitante anônimo', async () => {
    const resposta = await lerBruto(capaPublica)

    expect(resposta.status).toBe(200)
    expect(resposta.tipo).toBe('image/png')
    expect(resposta.bytes.length).toBe(256)
  })

  it('manda o navegador não adivinhar o tipo do arquivo', async () => {
    // Sem nosniff, um arquivo que fosse imagem válida e HTML ao mesmo tempo
    // poderia ser aberto como página dentro do nosso domínio.
    expect((await lerBruto(capaPublica)).nosniff).toBe('nosniff')
  })

  it('não entrega a capa de notícia interna para visitante anônimo', async () => {
    expect((await lerBruto(capaInterna)).status).toBe(404)
  })

  it('não entrega a capa de rascunho para visitante anônimo', async () => {
    expect((await lerBruto(capaRascunho)).status).toBe(404)
  })

  it('entrega a capa interna para praticante autenticado', async () => {
    const resposta = await lerBruto(capaInterna, praticante)

    expect(resposta.status).toBe(200)
    expect(resposta.tipo).toBe('image/png')
  })

  it('não deixa a capa interna em cache compartilhado', async () => {
    expect((await lerBruto(capaInterna, praticante)).cache).toContain('private')
    expect((await lerBruto(capaPublica)).cache).toContain('public')
  })

  it('não serve a capa de um post pelo endereço de outro', async () => {
    // O nome no endereço é comparado com o que está no banco; não é ele que
    // abre o arquivo. Sem essa conferência, o nome da capa interna serviria
    // como chave para baixá-la por baixo de um post público.
    const arquivo = capaInterna.split('/').pop()
    const disfarcado = `/api/publicacoes/${publica.slug}/capa/${arquivo}`

    expect((await lerBruto(disfarcado)).status).toBe(404)
  })

  it('responde 404 para nome de arquivo que não existe', async () => {
    const inventado = `/api/publicacoes/${publica.slug}/capa/${'0'.repeat(32)}.png`
    expect((await lerBruto(inventado)).status).toBe(404)
  })

  it('recusa HTML com nome e tipo de imagem', async () => {
    // A extensão diz .jpg e o navegador anuncia image/jpeg; os bytes dizem
    // outra coisa, e são os bytes que valem.
    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: publica.id }, {
      nome: 'foto.jpg',
      tipo: 'image/jpeg',
      bytes: new TextEncoder().encode('<!doctype html><script>alert(1)</script>'),
    }, { cookie: diretoria })

    expect(resposta.problemas).toHaveLength(1)
    expect(resposta.problemas[0]).toContain('JPEG')
  })

  it('recusa SVG', async () => {
    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: publica.id }, {
      nome: 'desenho.svg',
      tipo: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'),
    }, { cookie: diretoria })

    expect(resposta.problemas).toHaveLength(1)
  })

  it('recusa envio sem arquivo', async () => {
    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: publica.id },
      undefined, { cookie: diretoria })

    expect(resposta.problemas).toHaveLength(1)
  })

  it('o endereço da capa antiga para de responder depois da troca', async () => {
    const post = await criar('Notícia que troca de capa', 'PUBLICA', true)
    await enviarArquivo('/api/publicacoes/capa', { id: post.id }, imagemPng(),
      { cookie: diretoria })
    const antiga = (await enderecoDaCapa(post.id))!

    await enviarArquivo('/api/publicacoes/capa', { id: post.id }, imagemPng(),
      { cookie: diretoria })
    const nova = (await enderecoDaCapa(post.id))!

    expect(nova).not.toBe(antiga)
    expect((await lerBruto(nova)).status).toBe(200)
    expect((await lerBruto(antiga)).status).toBe(404)
  })

  it('remover tira a capa do ar', async () => {
    const post = await criar('Notícia que perde a capa', 'PUBLICA', true)
    await enviarArquivo('/api/publicacoes/capa', { id: post.id }, imagemPng(),
      { cookie: diretoria })
    const endereco = (await enderecoDaCapa(post.id))!

    await enviarArquivo('/api/publicacoes/capa', { id: post.id, acao: 'remover' },
      undefined, { cookie: diretoria })

    expect(await enderecoDaCapa(post.id)).toBeNull()
    expect((await lerBruto(endereco)).status).toBe(404)
  })

  it('aceita o envio nativo, sem JavaScript', async () => {
    // É o caminho que a tela usa de verdade: formulário multipart enviado pelo
    // navegador, resposta em redirecionamento e não em JSON.
    const post = await criar('Notícia com capa enviada sem script', 'PUBLICA', true)

    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: post.id },
      imagemPng(), { cookie: diretoria, nativo: true })

    expect(resposta.status).toBe(303)
    expect(resposta.destino).toBe(`/publicacoes/${post.id}`)
    expect((await lerBruto((await enderecoDaCapa(post.id))!)).status).toBe(200)
  })

  it('devolve o erro pela volta ao formulário no envio nativo', async () => {
    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: publica.id }, {
      nome: 'desenho.svg',
      tipo: 'image/svg+xml',
      bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    }, { cookie: diretoria, nativo: true })

    expect(resposta.status).toBe(303)
    expect(decodeURIComponent(resposta.destino)).toContain('JPEG')
  })

  it('a tela de edição traz o formulário de arquivo e mostra a capa atual', async () => {
    // Os bugs desta etapa apareceram na fronteira entre tela e servidor, não
    // dentro de nenhuma das duas. Um formulário sem enctype multipart passaria
    // por todo o resto da suíte e falharia no primeiro clique de verdade.
    const resposta = await lerBruto(`/publicacoes/${publica.id}`, diretoria)
    const html = new TextDecoder().decode(resposta.bytes)

    expect(resposta.status).toBe(200)
    expect(html).toContain('enctype="multipart/form-data"')
    expect(html).toContain('action="/api/publicacoes/capa"')
    expect(html).toContain(capaPublica)
  })

  it('praticante não troca a capa', async () => {
    const resposta = await enviarArquivo('/api/publicacoes/capa', { id: publica.id },
      imagemPng(), { cookie: praticante })

    expect(resposta.status).toBe(403)
  })
})
