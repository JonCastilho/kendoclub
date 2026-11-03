import {
  type LinhaDePagamento,
  cobrancaAtualizada,
  itensDaInscricao,
  ordenarPagamentos,
  resumirPagamentos,
  situacaoDaCobranca,
} from '~~/shared/cobrancaEvento'
import { estaFiliado } from '~~/shared/filiacao'

/**
 * Pagamentos do evento, para a diretoria: um por inscrito, com o que há para
 * conferir primeiro, e quanto já foi confirmado.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const slug = getRouterParam(event, 'slug')!
  const prisma = usePrisma()

  const evento = await prisma.evento.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: {
      id: true,
      titulo: true,
      slug: true,
      valorAlojamento: true,
      valorObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
      inscricoes: {
        select: {
          ...camposDaInscricao,
          cobranca: true,
          praticante: {
            select: { id: true, nomeCompleto: true, filiacoes: { select: { inicioEm: true, fimEm: true } } },
          },
        },
      },
    },
  })
  if (!evento) throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.' })

  const subeventos = evento.subeventos.map(subeventoDetalhado)

  const linhas: LinhaDePagamento[] = evento.inscricoes.map((inscricao) => {
    const detalhada = inscricaoComTotal(inscricao, evento, subeventos)
    const { cobranca } = inscricao

    return {
      praticanteId: inscricao.praticante.id,
      nome: inscricao.praticante.nomeCompleto,
      filiado: estaFiliado(inscricao.praticante.filiacoes),
      total: detalhada.total,
      cobranca: cobranca
        ? {
            id: cobranca.id,
            valor: Number(cobranca.valor),
            situacao: situacaoDaCobranca(cobranca),
            atualizada: cobrancaAtualizada(
              { valor: Number(cobranca.valor), itens: cobranca.itens },
              { total: detalhada.total, itens: itensDaInscricao(detalhada, subeventos) },
            ),
            declaradaEm: cobranca.declaradaEm?.toISOString() ?? null,
            analisadaEm: cobranca.analisadaEm?.toISOString() ?? null,
            motivoRecusa: cobranca.motivoRecusa,
            temComprovante: Boolean(cobranca.comprovante),
            observacao: cobranca.observacao,
          }
        : null,
    }
  })

  return {
    evento: { id: evento.id, titulo: evento.titulo, slug: evento.slug },
    resumo: resumirPagamentos(linhas),
    linhas: ordenarPagamentos(linhas),
  }
})
