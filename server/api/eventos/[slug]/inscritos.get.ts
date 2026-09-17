import { categoriasCompativeis } from '~~/shared/competicao'
import { type InscritosDoEvento, totaisDeObentoPorDia } from '~~/shared/evento'
import { estaFiliado } from '~~/shared/filiacao'

/**
 * Lista de inscritos, para a diretoria.
 *
 * Mostra se cada pessoa está filiada — estar filiado não é condição para se
 * inscrever, mas a diretoria precisa saber — e se a categoria gravada ainda
 * atende ao cadastro, já que tabela e cadastro podem mudar depois da inscrição.
 * No exame, traz o aviso de carência: a inscrição foi aceita, mas a diretoria
 * precisa saber.
 */
export default defineEventHandler(async (event): Promise<InscritosDoEvento> => {
  await exigirDiretoria(event)
  const slug = getRouterParam(event, 'slug')!
  const prisma = usePrisma()

  const evento = await prisma.evento.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: {
      id: true,
      titulo: true,
      slug: true,
      ofereceAlojamento: true,
      valorAlojamento: true,
      valorObento: true,
      diasObento: true,
      subeventos: { select: camposDoSubevento, orderBy: { criadoEm: 'asc' } },
      inscricoes: {
        orderBy: { praticante: { nomeCompleto: 'asc' } },
        select: {
          ...camposDaInscricao,
          praticante: {
            select: {
              id: true,
              nomeCompleto: true,
              filiacoes: { select: { inicioEm: true, fimEm: true } },
              ...camposDoCompetidor,
            },
          },
        },
      },
    },
  })
  if (!evento) throw createError({ statusCode: 404, statusMessage: 'Evento não encontrado.' })

  const subeventos = evento.subeventos.map(subeventoDetalhado)

  const carencias = await prisma.carenciaGraduacao.findMany({
    where: { modalidadeId: { in: subeventos.map(s => s.modalidade.id) } },
    select: { modalidadeId: true, grau: true, shogo: true, mesesMinimos: true },
  })

  const inscritos = evento.inscricoes.map((inscricao) => {
    const detalhada = inscricaoComTotal(inscricao, evento, subeventos)

    const foraDaCategoria = Object.entries(detalhada.competicoes)
      .filter(([subeventoId, participacao]) => {
        const subevento = subeventos.find(s => s.id === subeventoId)!
        const servem = categoriasCompativeis(subevento.categorias, competidorNa(inscricao.praticante, subevento))
        return !servem.some(c => c.id === participacao.categoriaId)
      })
      .map(([subeventoId]) => subeventoId)

    const avisosDeCarencia: Record<string, string> = {}
    for (const [subeventoId, exame] of Object.entries(detalhada.exames)) {
      const subevento = subeventos.find(s => s.id === subeventoId)!
      const aviso = avisoDeCarenciaNoExame(inscricao.praticante, subevento, exame, carencias)
      if (aviso) avisosDeCarencia[subeventoId] = aviso
    }

    return {
      praticanteId: inscricao.praticante.id,
      nome: inscricao.praticante.nomeCompleto,
      filiado: estaFiliado(inscricao.praticante.filiacoes),
      ...detalhada,
      foraDaCategoria,
      avisosDeCarencia,
    }
  })

  const totalEmCentavos = inscritos.reduce((soma, i) => soma + Math.round(i.total * 100), 0)

  return {
    evento: {
      id: evento.id,
      titulo: evento.titulo,
      slug: evento.slug,
      ofereceAlojamento: evento.ofereceAlojamento,
      diasObento: diasComoTexto(evento.diasObento),
    },
    subeventos,
    inscritos,
    totaisDeObento: totaisDeObentoPorDia(inscritos.map(i => ({
      obentos: Object.entries(i.obentos).map(([dia, quantidade]) => ({ dia, quantidade })),
    }))),
    comAlojamento: inscritos.filter(i => i.alojamento).length,
    total: totalEmCentavos / 100,
  }
})
