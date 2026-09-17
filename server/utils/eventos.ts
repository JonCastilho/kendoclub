import type { Prisma } from '@prisma/client'
import { interpretarValor } from '~~/shared/dinheiro'
import {
  type SubeventoDetalhado,
  diaDe,
  diasDoEvento,
  diasRemovidos,
  formatarDia,
  periodoDoEvento,
  totalDaInscricao,
} from '~~/shared/evento'

type Transacao = Prisma.TransactionClient

/** Dias gravados → texto `AAAA-MM-DD`, que é como as regras trabalham. */
export function diasComoTexto(dias: Date[]): string[] {
  return dias.map(diaDe).sort()
}

/** Texto `AAAA-MM-DD` → meia-noite UTC, como toda data de calendário do banco. */
export function diaComoData(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`)
}

export async function fusoDoClube(): Promise<string> {
  const configuracao = await usePrisma().configuracaoClube.findUnique({
    where: { id: 1 }, select: { fusoHorario: true },
  })
  return configuracao?.fusoHorario ?? 'America/Sao_Paulo'
}

/** Valor em reais vindo de formulário, ou nulo se vazio ou ilegível. */
export function valorOpcional(valor: unknown): number | null {
  return interpretarValor(texto(valor))
}

/**
 * Quanto uma mudança nos dias apagaria de encomenda de obento.
 *
 * Existe para a tela poder avisar antes: tirar a oferta de um dia, ou tirar o
 * dia de um subevento, apaga o que foi encomendado para ele.
 */
export async function obentosAfetados(
  eventoId: string,
  diasObentoAtuais: string[],
  diasObentoNovos: string[],
): Promise<{ dias: string[], quantidade: number }> {
  const dias = diasRemovidos(diasObentoAtuais, diasObentoNovos)
  if (dias.length === 0) return { dias, quantidade: 0 }

  const soma = await usePrisma().encomendaObento.aggregate({
    where: { inscricaoEvento: { eventoId }, dia: { in: dias.map(diaComoData) } },
    _sum: { quantidade: true },
  })

  return { dias, quantidade: soma._sum.quantidade ?? 0 }
}

/** O que será apagado, para a diretoria confirmar antes. */
export function avisoDeObentosApagados(afetados: { dias: string[], quantidade: number }): string {
  const dias = afetados.dias.map(formatarDia).join(', ')
  return `Isto apaga ${afetados.quantidade} obento(s) já encomendado(s) para ${dias}.`
}

/**
 * Refaz o que deriva dos subeventos e da oferta do evento: período, dias de
 * obento que continuam válidos, encomendas desses dias, alojamento de quem não
 * participa mais e inscrições que ficaram vazias.
 *
 * Roda dentro da mesma transação que mudou os subeventos ou a oferta de obento,
 * para o evento nunca ficar com período ou encomenda de um estado que já não
 * existe.
 */
export async function recalcularEvento(
  tx: Transacao,
  eventoId: string,
  diasObentoPretendidos?: string[],
) {
  const [evento, subeventos] = await Promise.all([
    tx.evento.findUniqueOrThrow({ where: { id: eventoId }, select: { diasObento: true, ofereceAlojamento: true } }),
    tx.subevento.findMany({ where: { eventoId }, select: { dias: true } }),
  ])

  const comDias = subeventos.map(s => ({ dias: diasComoTexto(s.dias) }))
  const diasValidos = diasDoEvento(comDias)
  const periodo = periodoDoEvento(comDias)

  const pretendidos = diasObentoPretendidos ?? diasComoTexto(evento.diasObento)
  const diasObento = pretendidos.filter(dia => diasValidos.includes(dia)).sort()

  await tx.evento.update({
    where: { id: eventoId },
    data: {
      inicioEm: periodo ? diaComoData(periodo.inicio) : null,
      fimEm: periodo ? diaComoData(periodo.fim) : null,
      diasObento: diasObento.map(diaComoData),
    },
  })

  await tx.encomendaObento.deleteMany({
    where: {
      inscricaoEvento: { eventoId },
      dia: { notIn: diasObento.map(diaComoData) },
    },
  })

  // Alojamento é só para quem participa, e só se o evento ainda oferece.
  await tx.inscricaoEvento.updateMany({
    where: evento.ofereceAlojamento
      ? { eventoId, alojamento: true, subeventos: { none: {} } }
      : { eventoId, alojamento: true },
    data: { alojamento: false },
  })

  // Quem tinha só obento num dia que saiu fica sem nada: inscrição vazia não
  // existe.
  await tx.inscricaoEvento.deleteMany({
    where: { eventoId, subeventos: { none: {} }, obentos: { none: {} } },
  })
}

/** Endereço único a partir do título, com sufixo numérico se já existir. */
export async function slugDeEventoDisponivel(base: string): Promise<string> {
  const prisma = usePrisma()

  for (let tentativa = 0; ; tentativa++) {
    const slug = tentativa === 0 ? base : `${base}-${tentativa + 1}`
    const existe = await prisma.evento.findUnique({ where: { slug }, select: { id: true } })
    if (!existe) return slug
  }
}

/** Colunas de subevento que as telas usam, com a contagem de inscritos. */
export const camposDoSubevento = {
  id: true,
  tipo: true,
  local: true,
  dias: true,
  valor: true,
  modalidade: { select: { id: true, nome: true } },
  _count: { select: { inscricoes: true } },
} satisfies Prisma.SubeventoSelect

type SubeventoDoBanco = Prisma.SubeventoGetPayload<{ select: typeof camposDoSubevento }>

export function subeventoDetalhado(subevento: SubeventoDoBanco): SubeventoDetalhado {
  return {
    id: subevento.id,
    tipo: subevento.tipo,
    modalidade: subevento.modalidade,
    local: subevento.local,
    dias: diasComoTexto(subevento.dias),
    valor: numeroOuNulo(subevento.valor),
    inscritos: subevento._count.inscricoes,
  }
}

/** Decimal do Prisma → número, para a tela não receber texto. */
export function numeroOuNulo(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : Number(valor)
}

type InscricaoDoBanco = {
  alojamento: boolean
  subeventos: Array<{ subeventoId: string }>
  obentos: Array<{ dia: Date, quantidade: number }>
}

/** Inscrição gravada → o formato das regras, com o total estimado. */
export function inscricaoComTotal(
  inscricao: InscricaoDoBanco,
  evento: { valorAlojamento: Prisma.Decimal | null, valorObento: Prisma.Decimal | null },
  subeventos: Array<{ id: string, valor: number | null }>,
) {
  const subeventoIds = inscricao.subeventos.map(s => s.subeventoId)
  const obentos = Object.fromEntries(inscricao.obentos.map(o => [diaDe(o.dia), o.quantidade]))

  return {
    subeventoIds,
    alojamento: inscricao.alojamento,
    obentos,
    total: totalDaInscricao({
      valoresDosSubeventos: subeventos.filter(s => subeventoIds.includes(s.id)).map(s => s.valor),
      alojamento: inscricao.alojamento,
      valorAlojamento: numeroOuNulo(evento.valorAlojamento),
      quantidadeDeObentos: inscricao.obentos.reduce((soma, o) => soma + o.quantidade, 0),
      valorObento: numeroOuNulo(evento.valorObento),
    }),
  }
}
