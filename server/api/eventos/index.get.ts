import { diaDe, hojeNoFuso, inscricoesAbertas } from '~~/shared/evento'
import { resumoDoTexto } from '~~/shared/markdown'

/**
 * A agenda. Atende visitante anônimo, então a visibilidade vai na consulta,
 * como no feed de notícias.
 *
 * Mostra o que ainda não terminou. A diretoria vê também os rascunhos, e com
 * `?todos=1` inclui os eventos passados — é a lista da tela de gestão.
 */
export default defineEventHandler(async (event) => {
  const leitor = await leitorAtual(event)
  const prisma = usePrisma()

  const hoje = hojeNoFuso(await fusoDoClube())
  const todos = leitor.ehDiretoria && getQuery(event).todos === '1'

  const eventos = await prisma.evento.findMany({
    where: {
      ...(leitor.ehDiretoria
        ? {}
        : {
            publicadoEm: { not: null },
            ...(leitor.logado ? {} : { visibilidade: 'PUBLICA' as const }),
          }),
      // Rascunho ainda sem data (fimEm nulo) só chega aqui para a diretoria,
      // porque evento sem data não pode ser publicado.
      ...(todos ? {} : { OR: [{ fimEm: { gte: diaComoData(hoje) } }, { fimEm: null }] }),
    },
    orderBy: [{ inicioEm: { sort: 'asc', nulls: 'last' } }, { criadoEm: 'asc' }],
    take: 100,
    select: {
      id: true,
      titulo: true,
      slug: true,
      descricao: true,
      visibilidade: true,
      publicadoEm: true,
      inicioEm: true,
      fimEm: true,
      prazoInscricao: true,
      subeventos: {
        select: { tipo: true, modalidade: { select: { nome: true } } },
        orderBy: { criadoEm: 'asc' },
      },
    },
  })

  return {
    leitorLogado: leitor.logado,
    eventos: eventos.map(e => ({
      id: e.id,
      titulo: e.titulo,
      slug: e.slug,
      resumo: resumoDoTexto(e.descricao),
      visibilidade: e.visibilidade,
      publicadoEm: e.publicadoEm,
      inicio: e.inicioEm ? diaDe(e.inicioEm) : null,
      fim: e.fimEm ? diaDe(e.fimEm) : null,
      prazoInscricao: diaDe(e.prazoInscricao),
      prazoAberto: inscricoesAbertas(diaDe(e.prazoInscricao), hoje),
      subeventos: e.subeventos.map(s => ({ tipo: s.tipo, modalidade: s.modalidade.nome })),
    })),
  }
})
