import { gerarSlug, problemasDaPublicacao } from '~~/shared/publicacao'

/**
 * Cria ou atualiza uma publicação. Publicar é ato separado, em publicar.post.ts:
 * escrever e tornar público são decisões diferentes.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const titulo = texto(corpo.titulo)
  const conteudo = texto(corpo.conteudo)
  const visibilidade = texto(corpo.visibilidade) === 'RESTRITA'
    ? ('RESTRITA' as const)
    : ('PUBLICA' as const)
  const voltar = id ? `/publicacoes/${id}` : '/publicacoes'

  const problemas = problemasDaPublicacao({ titulo, conteudo })
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const dados = {
    titulo,
    conteudo,
    visibilidade,
    imagemCapa: opcional(corpo.imagemCapa),
  }

  if (id) {
    // O endereço não muda quando o título é corrigido: link já compartilhado
    // continua funcionando.
    await prisma.publicacao.update({ where: { id }, data: dados })
    return responderSucesso(event, `/publicacoes/${id}`)
  }

  const criada = await prisma.publicacao.create({
    data: { ...dados, slug: await slugDisponivel(gerarSlug(titulo)), autorUsuarioId: usuario.id },
    select: { id: true },
  })

  return responderSucesso(event, `/publicacoes/${criada.id}`)
})

/** Acrescenta sufixo numérico enquanto o endereço já estiver em uso. */
async function slugDisponivel(base: string): Promise<string> {
  const prisma = usePrisma()

  for (let tentativa = 0; ; tentativa++) {
    const slug = tentativa === 0 ? base : `${base}-${tentativa + 1}`
    const existe = await prisma.publicacao.findUnique({ where: { slug }, select: { id: true } })
    if (!existe) return slug
  }
}
