import {
  type ExamePrestado,
  type ParticipacaoNaCompeticao,
  ROTULO_DO_TIPO,
  type SubeventoDetalhado,
  formatarDia,
} from './evento'
import { ROTULO_DO_SHOGO, rotuloDaGraduacao } from './graduacao'

/**
 * Dados do evento na ordem da planilha de inscrição na CBK (etapa 7.4).
 *
 * Quem se inscreve no sistema não preenche o que a planilha pede a mais — nome
 * no zekken/nafuda e posição na primeira luta —: é a diretoria, ao reunir os
 * dados, que decide e anota. O resto sai da inscrição.
 */

export type PosicaoNaEquipe = 'SENPO' | 'JIHO' | 'CHUKEN' | 'FUKUSHO' | 'TAISHO' | 'AVULSO'

/** Na ordem em que lutam; avulso fica por último, por não ser posição de time. */
export const POSICOES: PosicaoNaEquipe[] = ['SENPO', 'JIHO', 'CHUKEN', 'FUKUSHO', 'TAISHO', 'AVULSO']

export const ROTULO_DA_POSICAO: Record<PosicaoNaEquipe, string> = {
  SENPO: 'Senpo',
  JIHO: 'Jiho',
  CHUKEN: 'Chuken',
  FUKUSHO: 'Fukusho',
  TAISHO: 'Taisho',
  AVULSO: 'Avulso',
}

/** Cabe no zekken: o nome costuma ser só o sobrenome e, no máximo, um nome. */
export const TAMANHO_MAXIMO_DO_ZEKKEN = 40

/**
 * Coluna da tabela. As de tipo ZEKKEN e POSICAO são editáveis, uma por
 * competição; as demais são só leitura.
 */
export interface ColunaCbk {
  chave: string
  rotulo: string
  tipo: 'TEXTO' | 'ZEKKEN' | 'POSICAO'
  subeventoId?: string
}

/** O que a diretoria anota de quem compete: uma por competição. */
export interface FichaDeCompeticao {
  subeventoId: string
  inscricaoSubeventoId: string
  nomeNoZekken: string | null
  posicao: PosicaoNaEquipe | null
  /** Só quem compete por equipes tem posição. */
  naEquipe: boolean
}

export interface LinhaCbk {
  praticanteId: string
  nome: string
  /** Texto de cada coluna, por chave. Nas editáveis, o valor gravado. */
  celulas: Record<string, string>
  fichas: FichaDeCompeticao[]
}

export interface ResumoDaCompeticao {
  subeventoId: string
  rotulo: string
  individuais: number
  equipes: number
  avulsos: number
}

export interface TabelaCbk {
  colunas: ColunaCbk[]
  linhas: LinhaCbk[]
  resumo: ResumoDaCompeticao[]
}

export interface InscricaoParaCbk {
  praticanteId: string
  nome: string
  subeventoIds: string[]
  obentos: Record<string, number>
  competicoes: Record<string, ParticipacaoNaCompeticao>
  exames: Record<string, ExamePrestado>
  /** Subevento de competição → o que a diretoria anotou. */
  fichas: Record<string, {
    inscricaoSubeventoId: string
    nomeNoZekken: string | null
    posicaoNaEquipe: PosicaoNaEquipe | null
  }>
}

/** "Exame" quando há um só; "Exame (Iaido)" quando há mais de um do mesmo tipo. */
function rotuloDoSubevento(subevento: SubeventoDetalhado, subeventos: SubeventoDetalhado[], base: string) {
  const maisDeUm = subeventos.filter(s => s.tipo === subevento.tipo).length > 1
  return maisDeUm ? `${base} (${subevento.modalidade.nome})` : base
}

const sn = (verdadeiro: boolean) => (verdadeiro ? 'S' : 'N')

/** "7º dan e Renshi", "Renshi", "1º kyu". */
export function descreverExamePrestado(exame: ExamePrestado | undefined): string {
  if (!exame) return '—'
  return [
    exame.grau ? rotuloDaGraduacao(exame.grau) : null,
    exame.shogo ? ROTULO_DO_SHOGO[exame.shogo] : null,
  ].filter(Boolean).join(' e ')
}

/**
 * Monta a tabela na ordem da planilha: seminários por dia, exames, competições
 * (individual, categoria, equipe, categoria por equipes e zekken) e obentos por
 * dia. As colunas vêm dos subeventos do evento, então só aparece o que o evento
 * tem.
 */
export function montarTabelaCbk(
  subeventos: SubeventoDetalhado[],
  diasObento: string[],
  inscricoes: InscricaoParaCbk[],
): TabelaCbk {
  const colunas: ColunaCbk[] = []
  const doTipo = (tipo: SubeventoDetalhado['tipo']) => subeventos.filter(s => s.tipo === tipo)

  for (const seminario of doTipo('SEMINARIO')) {
    const base = rotuloDoSubevento(seminario, subeventos, ROTULO_DO_TIPO.SEMINARIO)
    for (const dia of seminario.dias) {
      colunas.push({ chave: `seminario:${seminario.id}:${dia}`, rotulo: `${base} — ${formatarDia(dia)}`, tipo: 'TEXTO' })
    }
  }

  for (const exame of doTipo('EXAME')) {
    const base = rotuloDoSubevento(exame, subeventos, ROTULO_DO_TIPO.EXAME)
    colunas.push({ chave: `exame:${exame.id}`, rotulo: base, tipo: 'TEXTO' })
    colunas.push({ chave: `exame-grau:${exame.id}`, rotulo: `${base} — o que presta`, tipo: 'TEXTO' })
  }

  for (const competicao of doTipo('COMPETICAO')) {
    const base = rotuloDoSubevento(competicao, subeventos, ROTULO_DO_TIPO.COMPETICAO)
    colunas.push(
      { chave: `competicao:${competicao.id}:individual`, rotulo: `${base} individual`, tipo: 'TEXTO' },
      { chave: `competicao:${competicao.id}:categoria-individual`, rotulo: `${base} — categoria individual`, tipo: 'TEXTO' },
      { chave: `competicao:${competicao.id}:equipe`, rotulo: `${base} por equipes — posição na primeira luta`, tipo: 'POSICAO', subeventoId: competicao.id },
      { chave: `competicao:${competicao.id}:categoria-equipe`, rotulo: `${base} — categoria por equipes`, tipo: 'TEXTO' },
      { chave: `competicao:${competicao.id}:zekken`, rotulo: `${base} — nome no zekken/nafuda`, tipo: 'ZEKKEN', subeventoId: competicao.id },
    )
  }

  for (const dia of diasObento) {
    colunas.push({ chave: `obento:${dia}`, rotulo: `Obento — ${formatarDia(dia)}`, tipo: 'TEXTO' })
  }

  const nomeDaCategoria = (subevento: SubeventoDetalhado, id: string | null | undefined) =>
    subevento.categorias.find(c => c.id === id)?.nome ?? '—'

  const linhas: LinhaCbk[] = inscricoes.map((inscricao) => {
    const celulas: Record<string, string> = {}
    const fichas: FichaDeCompeticao[] = []

    for (const seminario of doTipo('SEMINARIO')) {
      const vai = inscricao.subeventoIds.includes(seminario.id)
      for (const dia of seminario.dias) celulas[`seminario:${seminario.id}:${dia}`] = sn(vai)
    }

    for (const exame of doTipo('EXAME')) {
      celulas[`exame:${exame.id}`] = sn(inscricao.subeventoIds.includes(exame.id))
      celulas[`exame-grau:${exame.id}`] = descreverExamePrestado(inscricao.exames[exame.id])
    }

    for (const competicao of doTipo('COMPETICAO')) {
      const participacao = inscricao.competicoes[competicao.id]
      const ficha = inscricao.fichas[competicao.id]
      const naEquipe = Boolean(participacao?.categoriaEquipeId)

      celulas[`competicao:${competicao.id}:individual`] = sn(Boolean(participacao?.categoriaIndividualId))
      celulas[`competicao:${competicao.id}:categoria-individual`] = nomeDaCategoria(competicao, participacao?.categoriaIndividualId)
      celulas[`competicao:${competicao.id}:equipe`] = naEquipe
        ? (ficha?.posicaoNaEquipe ? ROTULO_DA_POSICAO[ficha.posicaoNaEquipe] : '')
        : 'N'
      celulas[`competicao:${competicao.id}:categoria-equipe`] = nomeDaCategoria(competicao, participacao?.categoriaEquipeId)
      celulas[`competicao:${competicao.id}:zekken`] = ficha?.nomeNoZekken ?? ''

      if (participacao && ficha) {
        fichas.push({
          subeventoId: competicao.id,
          inscricaoSubeventoId: ficha.inscricaoSubeventoId,
          nomeNoZekken: ficha.nomeNoZekken,
          posicao: ficha.posicaoNaEquipe,
          naEquipe,
        })
      }
    }

    for (const dia of diasObento) celulas[`obento:${dia}`] = String(inscricao.obentos[dia] ?? 0)

    return { praticanteId: inscricao.praticanteId, nome: inscricao.nome, celulas, fichas }
  })

  const resumo: ResumoDaCompeticao[] = doTipo('COMPETICAO').map((competicao) => {
    const dela = linhas.flatMap(l => l.fichas.filter(f => f.subeventoId === competicao.id))
    return {
      subeventoId: competicao.id,
      rotulo: rotuloDoSubevento(competicao, subeventos, ROTULO_DO_TIPO.COMPETICAO),
      individuais: inscricoes.filter(i => i.competicoes[competicao.id]?.categoriaIndividualId).length,
      equipes: dela.filter(f => f.naEquipe).length,
      avulsos: dela.filter(f => f.naEquipe && f.posicao === 'AVULSO').length,
    }
  })

  return { colunas, linhas, resumo }
}

/**
 * Valida o que a diretoria anotou de uma pessoa. Posição é de quem compete por
 * equipes; o zekken é opcional, porque a diretoria pode preencher aos poucos.
 */
export function problemasDaFicha(dados: {
  nome: string
  zekken: string
  posicao: string
  naEquipe: boolean
}): string[] {
  const problemas: string[] = []

  if (dados.zekken.length > TAMANHO_MAXIMO_DO_ZEKKEN) {
    problemas.push(`${dados.nome}: o nome no zekken tem no máximo ${TAMANHO_MAXIMO_DO_ZEKKEN} caracteres.`)
  }

  if (dados.posicao) {
    if (!POSICOES.includes(dados.posicao as PosicaoNaEquipe)) {
      problemas.push(`${dados.nome}: posição inválida.`)
    }
    else if (!dados.naEquipe) {
      problemas.push(`${dados.nome} não compete por equipes: a posição não se aplica.`)
    }
  }

  return problemas
}
