import { cobrancaAtualizada, itensDaInscricao, situacaoDaCobranca } from '~~/shared/cobrancaEvento'

/**
 * A cobrança de uma inscrição, conferida contra a inscrição de hoje: a
 * situação, e se o Pix gerado ainda bate com o total e os itens.
 *
 * Nulo se a pessoa não está inscrita. `cobranca` é nula se o Pix nunca foi
 * gerado.
 */
export async function cobrancaConferida(eventoId: string, praticanteId: string) {
  const prisma = usePrisma()

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      slug: true,
      titulo: true,
      valorAlojamento: true,
      valorObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
    },
  })
  if (!evento) return null

  const inscricao = await prisma.inscricaoEvento.findUnique({
    where: { eventoId_praticanteId: { eventoId, praticanteId } },
    select: { id: true, ...camposDaInscricao, cobranca: true },
  })
  if (!inscricao) return null

  const subeventos = evento.subeventos.map(subeventoDetalhado)
  const detalhada = inscricaoComTotal(inscricao, evento, subeventos)
  const itens = itensDaInscricao(detalhada, subeventos)
  const { cobranca } = inscricao

  return {
    evento,
    inscricao,
    detalhada,
    itens,
    cobranca,
    situacao: cobranca ? situacaoDaCobranca(cobranca) : null,
    atualizada: cobranca
      ? cobrancaAtualizada(
          { valor: Number(cobranca.valor), itens: cobranca.itens },
          { total: detalhada.total, itens },
        )
      : false,
  }
}
