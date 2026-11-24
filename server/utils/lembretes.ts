import { diaDe, hojeNoFuso } from '~~/shared/evento'
import {
  JANELA_DO_MARCO,
  type LembreteDevido,
  MARCOS_DO_LEMBRETE,
  montarEmailDeLembrete,
  planejarLembretes,
} from '~~/shared/lembrete'

/**
 * Lembrete de mensalidade em atraso. A tarefa diária e o botão da diretoria
 * passam por aqui: as regras estão em `shared/lembrete.ts`, e este arquivo só
 * lê o banco, manda o e-mail e registra o que saiu.
 */

const DIA_EM_MS = 86_400_000

/**
 * Quanto a data de referência pode andar além do vencimento: do dia 1 ao dia 31
 * do mesmo mês. Entra só para a consulta não deixar de fora quem combinou um
 * dia tardio; a regra exata continua em `planejarLembretes`.
 */
const FOLGA_DO_DIA_COMBINADO = 31

export interface PlanoDeLembretes {
  hoje: string
  nomeClube: string
  lembretes: LembreteDevido[]
}

export interface ResultadoDosLembretes {
  /** E-mails que saíram. */
  pessoas: number
  /** Mensalidades cobertas por esses e-mails. */
  mensalidades: number
  /** Pessoas que receberiam, mas o clube não configurou o servidor de e-mail. */
  semServidorDeEmail: number
  /** Envios que o servidor de e-mail recusou. */
  falhas: number
}

/**
 * Quem deve receber lembrete hoje, sem enviar nada. A tela da diretoria usa
 * isto para mostrar o que o botão vai fazer.
 *
 * "Hoje" é o dia no fuso do clube: o relógio do servidor, em UTC, já está no
 * dia seguinte às 21h de Brasília.
 */
export async function planoDeLembretes(agora: Date = new Date()): Promise<PlanoDeLembretes> {
  const prisma = usePrisma()

  const clube = await prisma.configuracaoClube.findUnique({
    where: { id: 1 },
    select: { nomeClube: true, fusoHorario: true },
  })
  const hoje = hojeNoFuso(clube?.fusoHorario ?? 'America/Sao_Paulo', agora)
  const meiaNoite = Date.parse(`${hoje}T00:00:00.000Z`)

  const primeiroMarco = MARCOS_DO_LEMBRETE[0]
  const ultimoMarco = MARCOS_DO_LEMBRETE[MARCOS_DO_LEMBRETE.length - 1]!
  const maisAtrasada = ultimoMarco + JANELA_DO_MARCO + FOLGA_DO_DIA_COMBINADO

  const mensalidades = await prisma.mensalidade.findMany({
    where: {
      situacao: 'ABERTA',
      vencimento: {
        lte: new Date(meiaNoite - primeiroMarco * DIA_EM_MS),
        gte: new Date(meiaNoite - maisAtrasada * DIA_EM_MS),
      },
    },
    select: {
      id: true,
      competencia: true,
      vencimento: true,
      valorTotal: true,
      situacao: true,
      declaracoes: { select: { pagoEm: true, analisadaEm: true, aceita: true, motivoRecusa: true } },
      lembretes: { select: { dias: true } },
      praticante: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
          diaDePagamento: true,
          usuario: { select: { id: true } },
        },
      },
    },
  })

  const lembretes = planejarLembretes(
    mensalidades.map(m => ({
      id: m.id,
      competencia: m.competencia,
      vencimento: diaDe(m.vencimento),
      valorTotal: m.valorTotal.toString(),
      situacao: m.situacao,
      declaracoes: m.declaracoes,
      enviados: m.lembretes.map(l => l.dias),
      praticante: {
        id: m.praticante.id,
        nomeCompleto: m.praticante.nomeCompleto,
        email: m.praticante.email,
        diaDePagamento: m.praticante.diaDePagamento,
        temAcesso: Boolean(m.praticante.usuario),
      },
    })),
    hoje,
  )

  return { hoje, nomeClube: clube?.nomeClube ?? 'Clube de Kendo', lembretes }
}

const ehConflitoDeUnicidade = (erro: unknown) => (erro as { code?: string })?.code === 'P2002'

/**
 * Envia os lembretes que vencem hoje.
 *
 * Seguro de repetir e de rodar em dobro: cada marco de cada mensalidade é
 * reservado numa linha única antes de o e-mail sair. Quem reserva primeiro
 * envia; a outra execução, ao esbarrar na unicidade, pula. Se o e-mail não
 * sai, a reserva é desfeita — o registro só guarda o que de fato foi enviado,
 * e a próxima execução tenta de novo.
 */
export async function enviarLembretesDeMensalidade(agora: Date = new Date()): Promise<ResultadoDosLembretes> {
  const prisma = usePrisma()
  const { nomeClube, lembretes } = await planoDeLembretes(agora)
  const { public: publico } = useRuntimeConfig()

  const resultado: ResultadoDosLembretes = { pessoas: 0, mensalidades: 0, semServidorDeEmail: 0, falhas: 0 }

  for (const lembrete of lembretes) {
    const reservados: LembreteDevido['itens'] = []

    for (const item of lembrete.itens) {
      try {
        await prisma.lembreteDeMensalidade.create({
          data: { mensalidadeId: item.mensalidadeId, dias: item.marco, para: lembrete.email },
        })
        reservados.push(item)
      }
      catch (erro) {
        // Outra execução reservou este marco um instante antes.
        if (!ehConflitoDeUnicidade(erro)) throw erro
      }
    }
    if (reservados.length === 0) continue

    const { assunto, texto } = montarEmailDeLembrete({
      nomeClube,
      nome: lembrete.nome,
      diaDePagamento: lembrete.diaDePagamento,
      itens: reservados,
      link: lembrete.temAcesso ? `${publico.appUrl}/minhas-mensalidades` : null,
    })

    let enviado = false
    let falhou = false
    try {
      enviado = await enviarEmail({ para: lembrete.email, assunto, texto })
    }
    catch (erro) {
      falhou = true
      console.error(`[lembretes] Falha ao enviar para ${lembrete.email}:`, erro)
    }

    if (enviado) {
      resultado.pessoas += 1
      resultado.mensalidades += reservados.length
      continue
    }

    await prisma.lembreteDeMensalidade.deleteMany({
      where: { OR: reservados.map(r => ({ mensalidadeId: r.mensalidadeId, dias: r.marco })) },
    })
    if (falhou) resultado.falhas += 1
    else resultado.semServidorDeEmail += 1
  }

  return resultado
}
