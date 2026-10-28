import { itensDaInscricao } from '~~/shared/cobrancaEvento'
import { podeVer } from '~~/shared/publicacao'

/**
 * Gera o Pix da inscrição: fixa o total e os itens do momento e devolve para a
 * tela, que mostra o QR code.
 *
 * O valor vem sempre da inscrição gravada, e nunca do formulário. Vale também
 * depois do prazo — quem se inscreveu ainda precisa pagar. Só a diretoria gera
 * para outra pessoa, que é o caso de quem não usa o sistema.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()
  const ehDiretoria = usuario.papel === 'DIRETORIA'

  const evento = await prisma.evento.findUnique({
    where: { id: texto(corpo.eventoId) },
    select: {
      id: true,
      slug: true,
      visibilidade: true,
      publicadoEm: true,
      valorAlojamento: true,
      valorObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
    },
  })

  const visivel = evento && podeVer(
    { visibilidade: evento.visibilidade, publicadaEm: evento.publicadoEm },
    { logado: true, ehDiretoria },
  )
  if (!evento || !visivel) return responderErro(event, ['Evento não encontrado.'], '/agenda')

  const pedido = texto(corpo.praticanteId)
  if (pedido && !ehDiretoria && pedido !== usuario.praticanteId) {
    throw createError({ statusCode: 403, statusMessage: 'Só a diretoria gera o Pix de outra pessoa.' })
  }
  const praticanteId = pedido || usuario.praticanteId
  const proprio = praticanteId === usuario.praticanteId
  const voltar = `/agenda/${evento.slug}${proprio ? '' : `?praticante=${praticanteId}`}#pix`

  if (!praticanteId) return responderErro(event, ['Sua conta não está ligada a um praticante.'], voltar)

  const inscricao = await prisma.inscricaoEvento.findUnique({
    where: { eventoId_praticanteId: { eventoId: evento.id, praticanteId } },
    select: { id: true, ...camposDaInscricao },
  })
  if (!inscricao) return responderErro(event, ['Salve a inscrição antes de gerar o Pix.'], voltar)

  const subeventos = evento.subeventos.map(subeventoDetalhado)
  const detalhada = inscricaoComTotal(inscricao, evento, subeventos)
  const itens = itensDaInscricao(detalhada, subeventos)

  if (detalhada.total <= 0) return responderErro(event, ['Esta inscrição não tem nada a pagar.'], voltar)

  const problemas = await problemasDaConfiguracaoDoPix()
  if (problemas.length > 0) {
    return responderErro(event, [
      'O clube ainda não configurou o Pix. Avise a diretoria.',
      ...(ehDiretoria ? problemas : []),
    ], voltar)
  }

  const dados = { valor: detalhada.total, itens, geradaEm: new Date() }
  await prisma.cobrancaEvento.upsert({
    where: { inscricaoEventoId: inscricao.id },
    create: { ...dados, inscricaoEventoId: inscricao.id },
    update: dados,
  })

  return responderSucesso(event, voltar)
})
