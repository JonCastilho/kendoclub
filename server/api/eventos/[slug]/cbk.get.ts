import { type InscricaoParaCbk, type TabelaCbk, montarTabelaCbk } from '~~/shared/cbk'
import { diaDe, inscricoesAbertas, hojeNoFuso } from '~~/shared/evento'

/**
 * Dados do evento na ordem da planilha de inscrição na CBK, para a diretoria.
 *
 * É calculado na hora, e não guardado: a tela fica disponível para novas
 * consultas e sempre mostra a inscrição como ela está. Quem usa a tela para
 * preencher a planilha vê, pelo aviso, se as inscrições ainda estão abertas.
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
      prazoInscricao: true,
      valorAlojamento: true,
      valorObento: true,
      diasObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
      inscricoes: {
        orderBy: { praticante: { nomeCompleto: 'asc' } },
        select: {
          ...camposDaInscricao,
          subeventos: {
            select: {
              ...camposDaInscricao.subeventos.select,
              id: true,
              nomeNoZekken: true,
              posicaoNaEquipe: true,
            },
          },
          praticante: { select: { id: true, nomeCompleto: true } },
        },
      },
    },
  })
  if (!evento) throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.' })

  const subeventos = evento.subeventos.map(subeventoDetalhado)
  const prazo = diaDe(evento.prazoInscricao)
  const diasObento = diasComoTexto(evento.diasObento)

  const inscricoes: InscricaoParaCbk[] = evento.inscricoes.map((inscricao) => {
    const detalhada = inscricaoComTotal(inscricao, evento, subeventos)
    return {
      praticanteId: inscricao.praticante.id,
      nome: inscricao.praticante.nomeCompleto,
      subeventoIds: detalhada.subeventoIds,
      obentos: detalhada.obentos,
      competicoes: detalhada.competicoes,
      exames: detalhada.exames,
      fichas: Object.fromEntries(inscricao.subeventos.map(s => [s.subeventoId, {
        inscricaoSubeventoId: s.id,
        nomeNoZekken: s.nomeNoZekken,
        posicaoNaEquipe: s.posicaoNaEquipe,
      }])),
    }
  })

  const tabela: TabelaCbk = montarTabelaCbk(subeventos, diasObento, inscricoes)

  return {
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      slug: evento.slug,
      prazo,
      inscricoesAbertas: inscricoesAbertas(prazo, hojeNoFuso(await fusoDoClube())),
    },
    ...tabela,
  }
})
