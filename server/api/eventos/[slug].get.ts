import { cobrancaAtualizada, itensDaInscricao } from '~~/shared/cobrancaEvento'
import {
  type CobrancaDoEvento,
  type EventoDetalhado,
  diaDe,
  diasDoEvento,
  hojeNoFuso,
  inscricoesAbertas,
} from '~~/shared/evento'
import { markdownParaHtml } from '~~/shared/markdown'
import { podeVer } from '~~/shared/publicacao'

/**
 * Detalhe do evento, com a inscrição de quem está lendo.
 *
 * A diretoria pode pedir a inscrição de outro praticante com `?praticante=`:
 * é o seletor do topo da página, que deixa a tela igual à do praticante.
 */
export default defineEventHandler(async (event): Promise<EventoDetalhado> => {
  const slug = getRouterParam(event, 'slug')!
  const leitor = await leitorAtual(event)
  const prisma = usePrisma()

  const evento = await prisma.evento.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
    },
  })

  // Mesma regra e mesma resposta das notícias: rascunho e evento interno não
  // existem para quem não pode ver.
  const visivel = evento && podeVer(
    { visibilidade: evento.visibilidade, publicadaEm: evento.publicadoEm }, leitor)
  if (!evento || !visivel) {
    throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.' })
  }

  const subeventos = evento.subeventos.map(subeventoDetalhado)
  const prazo = diaDe(evento.prazoInscricao)
  const prazoAberto = inscricoesAbertas(prazo, hojeNoFuso(await fusoDoClube()))

  const pedido = getQuery(event).praticante
  const praticanteId = leitor.ehDiretoria && typeof pedido === 'string' && pedido
    ? pedido
    : leitor.usuario?.praticanteId ?? null

  const praticante = praticanteId
    ? await prisma.praticante.findUnique({
        where: { id: praticanteId },
        select: { id: true, nomeCompleto: true, ...camposDoCompetidor },
      })
    : null

  const inscricao = praticante
    ? await prisma.inscricaoEvento.findUnique({
        where: { eventoId_praticanteId: { eventoId: evento.id, praticanteId: praticante.id } },
        select: {
          ...camposDaInscricao,
          cobranca: { select: { valor: true, itens: true, geradaEm: true } },
        },
      })
    : null

  const detalhada = inscricao ? inscricaoComTotal(inscricao, evento, subeventos) : null

  // O Pix vale enquanto a inscrição tem o mesmo total e os mesmos itens de
  // quando ele foi gerado; depois disso a tela pede um novo.
  let cobranca: CobrancaDoEvento | null = null
  if (inscricao?.cobranca && detalhada && praticante) {
    const gerada = { valor: Number(inscricao.cobranca.valor), itens: inscricao.cobranca.itens }
    const atualizada = cobrancaAtualizada(gerada, { total: detalhada.total, itens: itensDaInscricao(detalhada, subeventos) })
    cobranca = {
      ...gerada,
      geradaEm: inscricao.cobranca.geradaEm.toISOString(),
      atualizada,
      pix: atualizada ? await pixDaCobranca(gerada, praticante.nomeCompleto, evento.titulo) : null,
    }
  }
  const pixDisponivel = inscricao ? (await problemasDaConfiguracaoDoPix()).length === 0 : false

  const obentosPorDia: Record<string, number> = {}
  if (leitor.ehDiretoria) {
    const grupos = await prisma.encomendaObento.groupBy({
      by: ['dia'],
      where: { inscricaoEvento: { eventoId: evento.id } },
      _sum: { quantidade: true },
    })
    for (const grupo of grupos) obentosPorDia[diaDe(grupo.dia)] = grupo._sum.quantidade ?? 0
  }

  return {
    id: evento.id,
    titulo: evento.titulo,
    slug: evento.slug,
    descricao: evento.descricao,
    html: markdownParaHtml(evento.descricao),
    visibilidade: evento.visibilidade,
    publicadoEm: evento.publicadoEm?.toISOString() ?? null,
    prazoInscricao: prazo,
    inicio: evento.inicioEm ? diaDe(evento.inicioEm) : null,
    fim: evento.fimEm ? diaDe(evento.fimEm) : null,
    ofereceAlojamento: evento.ofereceAlojamento,
    valorAlojamento: numeroOuNulo(evento.valorAlojamento),
    enderecoAlojamento: evento.enderecoAlojamento,
    valorObento: numeroOuNulo(evento.valorObento),
    diasDoEvento: diasDoEvento(subeventos),
    diasObento: diasComoTexto(evento.diasObento),
    subeventos,

    prazoAberto,
    podeEditar: leitor.ehDiretoria,
    leitorLogado: leitor.logado,
    obentosPorDia,

    inscrevendo: praticante
      ? {
          praticanteId: praticante.id,
          nome: praticante.nomeCompleto,
          proprio: praticante.id === leitor.usuario?.praticanteId,
        }
      : null,
    // O prazo é a única regra que a diretoria dispensa.
    podeInscrever: Boolean(praticante) && (leitor.ehDiretoria || prazoAberto),
    inscricao: detalhada,
    cobranca,
    pixDisponivel,
    competidor: praticante ? situacaoNasCompeticoes(praticante, subeventos) : {},
    examinando: praticante ? situacaoNosExames(praticante, subeventos) : {},
  }
})
