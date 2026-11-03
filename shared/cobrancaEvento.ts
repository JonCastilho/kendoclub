import {
  type InscricaoDetalhada,
  ROTULO_DO_TIPO,
  type SituacaoDaCobranca,
  type SubeventoDetalhado,
} from './evento'

/**
 * O que se cobra de quem se inscreve num evento (etapa 7.4b).
 *
 * A cobrança nasce quando a pessoa gera o Pix: guarda o total e os itens
 * daquele momento. Mudar a inscrição depois não reescreve o que foi gerado —
 * só faz o Pix deixar de bater com a inscrição, e a tela pede um novo.
 */

/** "seminário", "competição (Iaido)", "alojamento", "obento (2)". */
export function itensDaInscricao(
  inscricao: Pick<InscricaoDetalhada, 'subeventoIds' | 'alojamento' | 'obentos'>,
  subeventos: Array<Pick<SubeventoDetalhado, 'id' | 'tipo' | 'modalidade'>>,
): string[] {
  const itens: string[] = []

  for (const subevento of subeventos) {
    if (!inscricao.subeventoIds.includes(subevento.id)) continue

    const rotulo = ROTULO_DO_TIPO[subevento.tipo].toLowerCase()
    const maisDeUmDoTipo = subeventos.filter(s => s.tipo === subevento.tipo).length > 1
    itens.push(maisDeUmDoTipo ? `${rotulo} (${subevento.modalidade.nome})` : rotulo)
  }

  if (inscricao.alojamento) itens.push('alojamento')

  const obentos = Object.values(inscricao.obentos).reduce((soma, quantidade) => soma + quantidade, 0)
  if (obentos > 0) itens.push(`obento (${obentos})`)

  return itens
}

/** O Pix gerado ainda vale: a inscrição tem o mesmo total e os mesmos itens. */
export function cobrancaAtualizada(
  gerada: { valor: number, itens: string[] },
  atual: { total: number, itens: string[] },
): boolean {
  return Math.round(gerada.valor * 100) === Math.round(atual.total * 100)
    && gerada.itens.length === atual.itens.length
    && gerada.itens.every((item, i) => item === atual.itens[i])
}

/**
 * Situação da cobrança, derivada: paga se a diretoria aceitou; em análise se a
 * pessoa declarou e ninguém analisou ainda; do contrário, só gerada — o que
 * inclui o comprovante recusado, que devolve a cobrança à pessoa.
 */
export function situacaoDaCobranca(cobranca: {
  declaradaEm: unknown
  analisadaEm: unknown
  aceita: boolean | null
}): SituacaoDaCobranca {
  if (cobranca.aceita === true) return 'PAGA'
  if (cobranca.declaradaEm && !cobranca.analisadaEm) return 'EM_ANALISE'
  return 'GERADA'
}

/** Pagamento declarado ou confirmado: quem se inscreveu não muda mais sozinho. */
export function inscricaoTravada(situacao: SituacaoDaCobranca | null): boolean {
  return situacao === 'EM_ANALISE' || situacao === 'PAGA'
}

const LIMITE_DO_MOTIVO = 200

/** O motivo da recusa é o que a pessoa lê para saber o que fazer. */
export function problemasDaRecusa(motivo: string): string[] {
  if (!motivo.trim()) return ['Diga por que o comprovante não confere.']
  if (motivo.length > LIMITE_DO_MOTIVO) return [`O motivo tem no máximo ${LIMITE_DO_MOTIVO} caracteres.`]
  return []
}

export type AcaoNoPagamento = 'aceitar' | 'recusar' | 'baixar' | 'estornar'

/**
 * O que a diretoria pode fazer em cada situação. Aceitar e recusar conferem um
 * comprovante, então só existem em análise; dar baixa é o pagamento feito fora
 * do sistema, sobre um Pix que ainda vale; estornar desfaz uma baixa errada.
 */
export function problemasDaAcao(
  acao: string,
  situacao: SituacaoDaCobranca,
  atualizada: boolean,
): string[] {
  switch (acao) {
    case 'aceitar':
    case 'recusar':
      return situacao === 'EM_ANALISE' ? [] : ['Não há comprovante aguardando conferência.']
    case 'baixar':
      if (situacao === 'PAGA') return ['Este pagamento já foi confirmado.']
      if (situacao === 'EM_ANALISE') return ['Há um comprovante aguardando conferência: aceite ou recuse.']
      return atualizada ? [] : ['A inscrição mudou depois do Pix. Gere um novo antes de dar baixa.']
    case 'estornar':
      return situacao === 'PAGA' ? [] : ['Só é possível estornar pagamento confirmado.']
    default:
      return ['Ação inválida.']
  }
}

/*
 * Tela de pagamentos da diretoria: uma linha por inscrito, com o estado da
 * cobrança, e o resumo de quanto já foi confirmado.
 */

export interface LinhaDePagamento {
  praticanteId: string
  nome: string
  filiado: boolean
  /** Total atual da inscrição. */
  total: number
  cobranca: {
    id: string
    valor: number
    situacao: SituacaoDaCobranca
    atualizada: boolean
    declaradaEm: string | null
    analisadaEm: string | null
    motivoRecusa: string | null
    temComprovante: boolean
    observacao: string | null
  } | null
}

export type EstadoDoPagamento = 'EM_ANALISE' | 'GERADA' | 'DESATUALIZADA' | 'SEM_PIX' | 'PAGA' | 'GRATUITA'

export const ROTULO_DO_ESTADO: Record<EstadoDoPagamento, string> = {
  EM_ANALISE: 'em análise',
  GERADA: 'Pix gerado',
  DESATUALIZADA: 'Pix desatualizado',
  SEM_PIX: 'sem Pix',
  PAGA: 'pago',
  GRATUITA: 'nada a pagar',
}

export function estadoDoPagamento(linha: Pick<LinhaDePagamento, 'total' | 'cobranca'>): EstadoDoPagamento {
  const { cobranca } = linha
  if (!cobranca) return linha.total > 0 ? 'SEM_PIX' : 'GRATUITA'
  if (cobranca.situacao === 'PAGA') return 'PAGA'
  if (cobranca.situacao === 'EM_ANALISE') return 'EM_ANALISE'
  return cobranca.atualizada ? 'GERADA' : 'DESATUALIZADA'
}

/** O que pede a atenção da diretoria vem primeiro: comprovante para conferir. */
const PRIORIDADE: EstadoDoPagamento[] = ['EM_ANALISE', 'GERADA', 'DESATUALIZADA', 'SEM_PIX', 'PAGA', 'GRATUITA']

export function ordenarPagamentos<T extends Pick<LinhaDePagamento, 'nome' | 'total' | 'cobranca'>>(linhas: T[]): T[] {
  return [...linhas].sort((a, b) =>
    PRIORIDADE.indexOf(estadoDoPagamento(a)) - PRIORIDADE.indexOf(estadoDoPagamento(b))
    || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export interface ResumoDePagamentos {
  porEstado: Record<EstadoDoPagamento, number>
  /** Soma do que a diretoria já confirmou. */
  confirmado: number
  /** Soma dos totais atuais de quem tem algo a pagar. */
  esperado: number
}

export function resumirPagamentos(linhas: Array<Pick<LinhaDePagamento, 'total' | 'cobranca'>>): ResumoDePagamentos {
  const porEstado: Record<EstadoDoPagamento, number> = {
    EM_ANALISE: 0, GERADA: 0, DESATUALIZADA: 0, SEM_PIX: 0, PAGA: 0, GRATUITA: 0,
  }
  let confirmado = 0
  let esperado = 0

  for (const linha of linhas) {
    const estado = estadoDoPagamento(linha)
    porEstado[estado]++
    esperado += Math.round(linha.total * 100)
    if (estado === 'PAGA') confirmado += Math.round(linha.cobranca!.valor * 100)
  }

  return { porEstado, confirmado: confirmado / 100, esperado: esperado / 100 }
}
