import type { Grau } from '@prisma/client'
import type { Categoria } from './competicao'
import type { Shogo } from './graduacao'
import { gerarSlug } from './publicacao'

/**
 * Regras de eventos e inscrições. Desenho e motivos em PLANO.md, etapa 7.
 *
 * Dias circulam aqui como texto `AAAA-MM-DD`. Dia de evento é data de
 * calendário, não instante: como texto, ordenar e comparar não passam por fuso
 * horário, e "2026-03-14" < "2026-03-15" já é a comparação certa.
 */

export type TipoSubevento = 'SEMINARIO' | 'COMPETICAO' | 'EXAME'

export const TIPOS_DISPONIVEIS: TipoSubevento[] = ['SEMINARIO', 'COMPETICAO', 'EXAME']

export const ROTULO_DO_TIPO: Record<TipoSubevento, string> = {
  SEMINARIO: 'Seminário',
  COMPETICAO: 'Competição',
  EXAME: 'Exame',
}

/**
 * Maior número que a coluna de quantidade guarda. Não é limite de encomenda —
 * a quantidade é livre —, só o que impede um número gigante de virar erro do
 * banco em vez de mensagem na tela.
 */
const MAIOR_INTEIRO_DO_BANCO = 2_147_483_647

const FORMATO_DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function ehDiaValido(texto: string): boolean {
  if (!FORMATO_DIA.test(texto)) return false
  // Pega 31 de fevereiro: o Date "corrige" para março, e aí o texto não bate.
  return new Date(`${texto}T00:00:00.000Z`).toISOString().startsWith(texto)
}

/** Dia de uma data gravada como meia-noite UTC. */
export function diaDe(data: Date | string): string {
  return new Date(data).toISOString().slice(0, 10)
}

/**
 * Hoje, no fuso do clube.
 *
 * Usar o relógio do servidor erraria perto da meia-noite: servidor em UTC já
 * está no dia seguinte às 21h de Brasília, e o prazo fecharia três horas antes.
 */
export function hojeNoFuso(fuso: string, agora: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora)
}

/** O prazo vale até o fim do dia: no próprio dia do prazo, ainda está aberto. */
export function inscricoesAbertas(prazo: string, hoje: string): boolean {
  return hoje <= prazo
}

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** '2026-03-14' → 'sáb, 14/03/2026' */
export function formatarDia(dia: string): string {
  const [ano, mes, numero] = dia.split('-')
  const semana = DIAS_DA_SEMANA[new Date(`${dia}T00:00:00.000Z`).getUTCDay()]
  return `${semana}, ${numero}/${mes}/${ano}`
}

/** Todos os dias em que há algum subevento, sem repetição e em ordem. */
export function diasDoEvento(subeventos: Array<{ dias: string[] }>): string[] {
  return [...new Set(subeventos.flatMap(s => s.dias))].sort()
}

/** Primeiro e último dia do evento, ou nulo enquanto nenhum subevento tem data. */
export function periodoDoEvento(
  subeventos: Array<{ dias: string[] }>,
): { inicio: string, fim: string } | null {
  const dias = diasDoEvento(subeventos)
  if (dias.length === 0) return null
  return { inicio: dias[0]!, fim: dias[dias.length - 1]! }
}

export interface DadosDoEvento {
  titulo: string
  descricao: string
  prazoInscricao: string
  ofereceAlojamento: boolean
  valorAlojamento: number | null
  enderecoAlojamento: string | null
  valorObento: number | null
  diasObento: string[]
}

/**
 * Problemas do evento. `diasDoEvento` vem dos subeventos já gravados: é deles
 * que dependem o limite do prazo e os dias em que dá para oferecer obento.
 */
export function problemasDoEvento(dados: DadosDoEvento, diasDoEvento: string[]): string[] {
  const problemas: string[] = []

  if (!dados.titulo.trim()) problemas.push('Informe o título.')
  else if (!gerarSlug(dados.titulo)) problemas.push('O título precisa ter letras ou números.')

  if (!dados.descricao.trim()) problemas.push('Escreva a descrição do evento.')

  if (!ehDiaValido(dados.prazoInscricao)) {
    problemas.push('Informe o prazo de inscrição.')
  }
  else if (diasDoEvento.length > 0 && dados.prazoInscricao > diasDoEvento[0]!) {
    problemas.push(
      `O prazo de inscrição não pode ser depois do primeiro dia do evento (${formatarDia(diasDoEvento[0]!)}).`)
  }

  if (dados.ofereceAlojamento) {
    if (dados.valorAlojamento === null) problemas.push('Informe o valor do alojamento.')
    if (!dados.enderecoAlojamento?.trim()) problemas.push('Informe o endereço do alojamento.')
  }

  if (dados.diasObento.length > 0) {
    if (dados.valorObento === null) problemas.push('Informe o valor do obento.')
    if (dados.diasObento.some(dia => !diasDoEvento.includes(dia))) {
      problemas.push('Obento só pode ser oferecido em dia que tenha subevento.')
    }
  }

  return problemas
}

export interface DadosDoSubevento {
  tipo: string
  modalidadeId: string
  local: string
  dias: string[]
  valor: number | null
}

/**
 * `existente` separa criar de editar: o valor de participação só é pedido
 * depois que o subevento existe, na tela de edição. Publicar é que exige.
 */
export function problemasDoSubevento(dados: DadosDoSubevento, opcoes: { existente: boolean }): string[] {
  const problemas: string[] = []

  if (!TIPOS_DISPONIVEIS.includes(dados.tipo as TipoSubevento)) {
    problemas.push('Tipo de subevento indisponível.')
  }
  if (!dados.modalidadeId) problemas.push('Escolha a modalidade.')
  if (!dados.local.trim()) problemas.push('Informe o local.')

  if (dados.dias.length === 0) problemas.push('Informe ao menos um dia.')
  else if (dados.dias.some(dia => !ehDiaValido(dia))) problemas.push('Há um dia inválido.')

  // Seminário e competição têm valor de participação; zero é gratuito. Na
  // competição, a isenção é por categoria.
  if (opcoes.existente && ['SEMINARIO', 'COMPETICAO'].includes(dados.tipo) && dados.valor === null) {
    problemas.push('Informe o valor de participação. Use 0 se for gratuito.')
  }

  return problemas
}

/**
 * O que impede a publicação.
 *
 * Evento sem subevento com data não tem o que mostrar na agenda; competição
 * sem categoria e exame sem banca não aceitariam inscrição de ninguém; e
 * seminário ou competição sem valor não teriam o que cobrar.
 */
export function problemasParaPublicar(
  subeventos: Array<{
    dias: string[]
    tipo?: TipoSubevento
    categorias?: number
    graduacoes?: number
    shogos?: number
    /** Nulo é "ainda não informado"; ausente é "não conferir". */
    valor?: number | null
    nome?: string
  }>,
): string[] {
  const problemas: string[] = []

  if (diasDoEvento(subeventos).length === 0) {
    problemas.push('Adicione ao menos um subevento com data antes de publicar.')
  }

  for (const subevento of subeventos) {
    if (subevento.tipo === 'COMPETICAO' && !subevento.categorias) {
      problemas.push(`Cadastre ao menos uma categoria em ${subevento.nome ?? 'competição'} antes de publicar.`)
    }
    if (subevento.tipo === 'EXAME' && !subevento.graduacoes && !subevento.shogos) {
      problemas.push(`Ofereça ao menos uma graduação em ${subevento.nome ?? 'exame'} antes de publicar.`)
    }
    if (subevento.tipo !== 'EXAME' && subevento.valor === null) {
      problemas.push(`Informe o valor de participação em ${subevento.nome ?? 'subevento'} antes de publicar.`)
    }
  }

  return problemas
}

/**
 * Dias de obento que deixam de existir quando a oferta muda — seja porque a
 * diretoria desmarcou o dia, seja porque o subevento daquele dia saiu.
 */
export function diasRemovidos(anteriores: string[], novos: string[]): string[] {
  return anteriores.filter(dia => !novos.includes(dia))
}

export interface EscolhaDeInscricao {
  subeventoIds: string[]
  alojamento: boolean
  /** Dia → quantidade, como veio do formulário. */
  obentos: Record<string, number>
}

export interface EventoParaInscricao {
  subeventoIds: string[]
  ofereceAlojamento: boolean
  diasObento: string[]
}

export interface InscricaoNormalizada {
  subeventoIds: string[]
  alojamento: boolean
  /** Só dias com quantidade positiva. */
  obentos: Record<string, number>
}

/**
 * Transforma o que foi marcado na tela no que será gravado.
 *
 * O formulário manda sempre o estado inteiro da inscrição, não um "inscrever"
 * ou "desistir" solto. Estado vazio é desistência — por isso `vazia` não é
 * problema, é a resposta.
 */
export function normalizarInscricao(
  escolha: EscolhaDeInscricao,
  evento: EventoParaInscricao,
): { inscricao: InscricaoNormalizada, problemas: string[], vazia: boolean } {
  const problemas: string[] = []

  const subeventoIds = [...new Set(escolha.subeventoIds)]
  if (subeventoIds.some(id => !evento.subeventoIds.includes(id))) {
    problemas.push('Um dos subeventos escolhidos não pertence a este evento.')
  }

  const obentos: Record<string, number> = {}
  for (const [dia, quantidade] of Object.entries(escolha.obentos)) {
    if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > MAIOR_INTEIRO_DO_BANCO) {
      problemas.push('A quantidade de obentos precisa ser um número inteiro.')
      continue
    }
    if (quantidade === 0) continue
    if (!evento.diasObento.includes(dia)) {
      problemas.push('Não há oferta de obento em um dos dias escolhidos.')
      continue
    }
    obentos[dia] = quantidade
  }

  const participa = subeventoIds.length > 0

  // Alojamento é só para quem participa: desistir do último subevento desmarca
  // o alojamento em silêncio, como previsto no plano, em vez de travar a
  // desistência com um erro.
  const alojamento = escolha.alojamento && evento.ofereceAlojamento && participa

  return {
    inscricao: { subeventoIds, alojamento, obentos },
    problemas,
    vazia: !participa && Object.keys(obentos).length === 0,
  }
}

type Valor = number | string | null | undefined

function centavos(valor: Valor): number {
  return Math.round(Number(valor ?? 0) * 100)
}

/**
 * Total estimado da inscrição, em reais.
 *
 * "Estimado" porque a cobrança só nasce no fechamento das inscrições, com os
 * valores daquele momento. A soma é feita em centavos inteiros: 0,1 + 0,2 em
 * ponto flutuante não dá 0,3.
 */
export function totalDaInscricao(dados: {
  valoresDosSubeventos: Valor[]
  alojamento: boolean
  valorAlojamento: Valor
  quantidadeDeObentos: number
  valorObento: Valor
}): number {
  const soma = dados.valoresDosSubeventos.reduce<number>((total, v) => total + centavos(v), 0)
    + (dados.alojamento ? centavos(dados.valorAlojamento) : 0)
    + dados.quantidadeDeObentos * centavos(dados.valorObento)

  return soma / 100
}

/** Obentos por dia, somados entre todas as inscrições — o número do pedido. */
export function totaisDeObentoPorDia(
  inscricoes: Array<{ obentos: Array<{ dia: string, quantidade: number }> }>,
): Record<string, number> {
  const totais: Record<string, number> = {}
  for (const inscricao of inscricoes) {
    for (const { dia, quantidade } of inscricao.obentos) {
      totais[dia] = (totais[dia] ?? 0) + quantidade
    }
  }
  return totais
}

/*
 * Formato das respostas dos endpoints de evento.
 *
 * Escritos à mão pelo mesmo motivo das notícias: a inferência do `useFetch` não
 * alcança rota dinâmica que convive com rotas estáticas no mesmo caminho.
 */

export type CategoriaDetalhada = Categoria & { inscritos: number }

export interface SubeventoDetalhado {
  id: string
  tipo: TipoSubevento
  modalidade: { id: string, nome: string, kyuInicial: number }
  local: string
  dias: string[]
  valor: number | null
  inscritos: number
  /** Só em competição. */
  categorias: CategoriaDetalhada[]
  /** Só em exame: graduações e shogos com banca. */
  graduacoes: GraduacaoOferecida[]
  shogos: ShogoOferecido[]
}

export interface ShogoOferecido {
  id: string
  shogo: Shogo
  valor: number
  inscritos: number
}

/** Um exame prestado: a graduação, o shogo, ou os dois. */
export interface ExamePrestado {
  grau: Grau | null
  shogo: Shogo | null
}

export interface GraduacaoOferecida {
  id: string
  grau: Grau
  valor: number
  inscritos: number
}

/** O que o cadastro diz de quem está sendo inscrito, em cada exame. */
export interface SituacaoNoExame {
  grauAtual: Grau | null
  shogosAtuais: Shogo[]
  /** Graduação seguinte; nulo no 8º dan. */
  grau: Grau | null
  temBancaDeGrau: boolean
  /** Shogo liberado pelo cadastro; nulo se nenhum. */
  shogo: Shogo | null
  temBancaDeShogo: boolean
}

export interface ParticipacaoNaCompeticao {
  categoriaId: string
  individual: boolean
  equipe: boolean
}

export type InscricaoDetalhada = InscricaoNormalizada & {
  /** Subevento de competição → como participa. */
  competicoes: Record<string, ParticipacaoNaCompeticao>
  /** Subevento de exame → graduação e shogo prestados. */
  exames: Record<string, ExamePrestado>
  total: number
}

/** O que o cadastro diz de quem está sendo inscrito, em cada competição. */
export interface SituacaoNaCompeticao {
  idade: number
  grau: Grau | null
  compativeis: string[]
}

export interface EventoDetalhado {
  id: string
  titulo: string
  slug: string
  descricao: string
  html: string
  visibilidade: 'PUBLICA' | 'RESTRITA'
  publicadoEm: string | null
  prazoInscricao: string
  inicio: string | null
  fim: string | null
  ofereceAlojamento: boolean
  valorAlojamento: number | null
  enderecoAlojamento: string | null
  valorObento: number | null
  diasDoEvento: string[]
  diasObento: string[]
  subeventos: SubeventoDetalhado[]

  prazoAberto: boolean
  podeEditar: boolean
  leitorLogado: boolean
  /** Só para a diretoria: quanto já foi encomendado em cada dia. */
  obentosPorDia: Record<string, number>

  /** De quem é a inscrição mostrada: o leitor, ou quem a diretoria escolheu. */
  inscrevendo: { praticanteId: string, nome: string, proprio: boolean } | null
  podeInscrever: boolean
  inscricao: InscricaoDetalhada | null
  /** Subevento de competição → idade, grau e categorias que servem. */
  competidor: Record<string, SituacaoNaCompeticao>
  /** Subevento de exame → graduação atual e o que pode prestar. */
  examinando: Record<string, SituacaoNoExame>
}

export interface InscritoNoEvento {
  praticanteId: string
  nome: string
  filiado: boolean
  subeventoIds: string[]
  alojamento: boolean
  obentos: Record<string, number>
  competicoes: Record<string, ParticipacaoNaCompeticao>
  exames: Record<string, ExamePrestado>
  /**
   * Competições em que a categoria gravada já não atende ao cadastro — a
   * tabela ou o cadastro mudou depois da inscrição.
   */
  foraDaCategoria: string[]
  /** Subevento de exame → aviso de carência, se houver. */
  avisosDeCarencia: Record<string, string>
  total: number
}

export interface InscritosDoEvento {
  evento: {
    id: string
    titulo: string
    slug: string
    ofereceAlojamento: boolean
    diasObento: string[]
  }
  subeventos: SubeventoDetalhado[]
  inscritos: InscritoNoEvento[]
  totaisDeObento: Record<string, number>
  comAlojamento: number
  total: number
}
