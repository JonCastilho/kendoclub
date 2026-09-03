import { beforeAll, describe, expect, it } from 'vitest'
import { comoDiretoria, dadosDePraticante, entrar, enviar, gerarCpf, ler } from './ajudantes'

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
