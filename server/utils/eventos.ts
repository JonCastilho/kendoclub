import type { Grau, Prisma } from '@prisma/client'
import { interpretarValor } from '~~/shared/dinheiro'
import { type Competidor, categoriasCompativeis, idadeNoAno } from '~~/shared/competicao'
import {
  type InscricaoDetalhada,
  type SituacaoNaCompeticao,
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

/** Colunas de subevento que as telas usam, com contagens de inscritos. */
export const camposDoSubevento = {
  id: true,
  tipo: true,
  local: true,
  dias: true,
  valor: true,
  modalidade: { select: { id: true, nome: true, kyuInicial: true } },
  _count: { select: { inscricoes: true } },
  categorias: {
    orderBy: { criadoEm: 'asc' },
    select: {
      id: true,
      nome: true,
      sexo: true,
      idadeMinima: true,
      idadeMaxima: true,
      grauMinimo: true,
      grauMaximo: true,
      isenta: true,
      _count: { select: { inscricoes: true } },
    },
  },
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
    categorias: subevento.categorias.map(c => ({
      id: c.id,
      nome: c.nome,
      sexo: c.sexo,
      idadeMinima: c.idadeMinima,
      idadeMaxima: c.idadeMaxima,
      grauMinimo: c.grauMinimo,
      grauMaximo: c.grauMaximo,
      isenta: c.isenta,
      inscritos: c._count.inscricoes,
    })),
  }
}

/** Decimal do Prisma → número, para a tela não receber texto. */
export function numeroOuNulo(valor: Prisma.Decimal | null): number | null {
  return valor === null ? null : Number(valor)
}

/** O que do cadastro decide a categoria. */
export const camposDoCompetidor = {
  sexo: true,
  dataNascimento: true,
  modalidades: { select: { modalidadeId: true, grau: true } },
} satisfies Prisma.PraticanteSelect

export interface PraticanteCompetidor {
  sexo: 'MASCULINO' | 'FEMININO'
  dataNascimento: Date
  modalidades: Array<{ modalidadeId: string, grau: Grau | null }>
}

/**
 * Sexo, idade no ano e graduação do praticante numa competição.
 * Quem não tem a modalidade no cadastro conta como mukyu nela.
 */
export function competidorNa(
  praticante: PraticanteCompetidor,
  subevento: Pick<SubeventoDetalhado, 'modalidade' | 'dias'>,
): Competidor {
  return {
    sexo: praticante.sexo,
    idade: idadeNoAno(diaDe(praticante.dataNascimento), subevento.dias[0] ?? diaDe(new Date())),
    grau: praticante.modalidades.find(m => m.modalidadeId === subevento.modalidade.id)?.grau ?? null,
  }
}

/** Situação do praticante em cada competição do evento, para a tela. */
export function situacaoNasCompeticoes(
  praticante: PraticanteCompetidor,
  subeventos: SubeventoDetalhado[],
): Record<string, SituacaoNaCompeticao> {
  const situacao: Record<string, SituacaoNaCompeticao> = {}

  for (const subevento of subeventos.filter(s => s.tipo === 'COMPETICAO')) {
    const competidor = competidorNa(praticante, subevento)
    situacao[subevento.id] = {
      idade: competidor.idade,
      grau: competidor.grau,
      compativeis: categoriasCompativeis(subevento.categorias, competidor).map(c => c.id),
    }
  }

  return situacao
}

type InscricaoDoBanco = {
  alojamento: boolean
  subeventos: Array<{
    subeventoId: string
    categoriaId: string | null
    individual: boolean | null
    equipe: boolean | null
  }>
  obentos: Array<{ dia: Date, quantidade: number }>
}

/** Campos da inscrição que `inscricaoComTotal` lê. */
export const camposDaInscricao = {
  alojamento: true,
  subeventos: { select: { subeventoId: true, categoriaId: true, individual: true, equipe: true } },
  obentos: { select: { dia: true, quantidade: true } },
} satisfies Prisma.InscricaoEventoSelect

/**
 * Inscrição gravada → o formato das telas, com o total estimado.
 *
 * O valor é sempre o do subevento. Em competição, categoria isenta zera a
 * participação de quem compete nela.
 */
export function inscricaoComTotal(
  inscricao: InscricaoDoBanco,
  evento: { valorAlojamento: Prisma.Decimal | null, valorObento: Prisma.Decimal | null },
  subeventos: SubeventoDetalhado[],
): InscricaoDetalhada {
  const subeventoIds = inscricao.subeventos.map(s => s.subeventoId)
  const obentos = Object.fromEntries(inscricao.obentos.map(o => [diaDe(o.dia), o.quantidade]))

  const competicoes: InscricaoDetalhada['competicoes'] = {}
  const valores: Array<number | null> = []

  for (const escolhido of inscricao.subeventos) {
    const subevento = subeventos.find(s => s.id === escolhido.subeventoId)
    if (!subevento) continue

    if (escolhido.categoriaId) {
      competicoes[subevento.id] = {
        categoriaId: escolhido.categoriaId,
        individual: Boolean(escolhido.individual),
        equipe: Boolean(escolhido.equipe),
      }
      const isenta = subevento.categorias.find(c => c.id === escolhido.categoriaId)?.isenta
      valores.push(isenta ? 0 : subevento.valor)
    }
    else {
      valores.push(subevento.valor)
    }
  }

  return {
    subeventoIds,
    alojamento: inscricao.alojamento,
    obentos,
    competicoes,
    total: totalDaInscricao({
      valoresDosSubeventos: valores,
      alojamento: inscricao.alojamento,
      valorAlojamento: numeroOuNulo(evento.valorAlojamento),
      quantidadeDeObentos: inscricao.obentos.reduce((soma, o) => soma + o.quantidade, 0),
      valorObento: numeroOuNulo(evento.valorObento),
    }),
  }
}
