/**
 * Publica ou volta a rascunho.
 *
 * Fica em rota própria, e recebe o id pelo corpo, porque `[slug].get.ts` já ocupa
 * o segmento dinâmico deste caminho — dois parâmetros diferentes no mesmo nível
 * seriam ambíguos para o roteador.
 *
 * Publicar é ato separado de escrever: dá para redigir hoje e tornar visível
 * quando o clube quiser.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const id = texto(corpo.id)
  const voltar = `/publicacoes/${id}`
  const prisma = usePrisma()

  const publicacao = await prisma.publicacao.findUnique({ where: { id } })
  if (!publicacao) return responderErro(event, ['Publicação não encontrada.'], '/publicacoes')

  const despublicar = texto(corpo.acao) === 'despublicar'

  await prisma.publicacao.update({
    where: { id },
    // Republicar não reescreve a data original: o feed continua ordenado pelo
    // dia em que a notícia saiu, e não pelo último ajuste de texto.
    data: { publicadaEm: despublicar ? null : (publicacao.publicadaEm ?? new Date()) },
  })

  return responderSucesso(event, voltar)
})
