import { ehCompetenciaValida } from './competencia'

/**
 * Regras da geração de mensalidade. Ficam aqui, puras, porque é onde um erro
 * custa dinheiro de gente — e porque assim dá para testar todo caso de borda de
 * data sem subir banco nem servidor.
 */

export type RegraCobrancaAluguel = 'ABERTO_NO_PRIMEIRO_DIA' | 'ABERTO_EM_QUALQUER_DIA'
export type TipoLinha = 'MENSALIDADE' | 'ALUGUEL' | 'OUTRO'

export interface Periodo {
  inicioEm: Date
  fimEm?: Date | null
}

export interface Linha {
  tipo: TipoLinha
  descricao: string
  valor: number
  aluguelId?: string | null
}

/** Primeiro e último dia da competência, em UTC. */
export function limitesDaCompetencia(competencia: string): { primeiroDia: Date, ultimoDia: Date } {
  if (!ehCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`)
  }

  const [ano, mes] = competencia.split('-').map(Number)

  return {
    primeiroDia: new Date(Date.UTC(ano!, mes! - 1, 1)),
    // Dia 0 do mês seguinte é o último dia deste — sem precisar saber quantos
    // dias tem o mês nem se o ano é bissexto.
    ultimoDia: new Date(Date.UTC(ano!, mes!, 0)),
  }
}

/** O período cobre a data? Período sem fim é aberto, e cobre tudo daí em diante. */
export function estavaAtivoEm(periodos: Periodo[], data: Date): boolean {
  return periodos.some(p => p.inicioEm <= data && (!p.fimEm || p.fimEm >= data))
}

/**
 * Gera cobrança para quem estava filiado no primeiro dia da competência.
 *
 * Quem se filia no meio do mês começa a pagar no mês seguinte — decisão da
 * diretoria, registrada no PLANO.md. Não há proporcional.
 */
export function deveGerarPara(filiacoes: Periodo[], competencia: string): boolean {
  return estavaAtivoEm(filiacoes, limitesDaCompetencia(competencia).primeiroDia)
}

export type AbrangenciaIsencao = 'MENSALIDADE' | 'ALUGUEL' | 'TUDO'

export interface Isencao extends Periodo {
  abrangencia: AbrangenciaIsencao
  motivo: string
}

/**
 * Isenções que valem para a competência.
 *
 * Como no resto da cobrança, o que decide é o primeiro dia do mês: gratuidade
 * concedida no dia 10 começa a valer no mês seguinte, do mesmo jeito que a
 * filiação.
 */
export function isencoesVigentesEm(isencoes: Isencao[], competencia: string): Isencao[] {
  const { primeiroDia } = limitesDaCompetencia(competencia)
  return isencoes.filter(i => i.inicioEm <= primeiroDia && (!i.fimEm || i.fimEm >= primeiroDia))
}

/** A isenção que cobre determinado tipo de linha, se houver. */
export function isencaoQueCobre(
  isencoes: Isencao[],
  alvo: 'MENSALIDADE' | 'ALUGUEL',
): Isencao | null {
  return isencoes.find(i => i.abrangencia === alvo || i.abrangencia === 'TUDO') ?? null
}

/** Quais aluguéis entram na competência, conforme a regra do clube. */
export function alugueisDaCompetencia<T extends Periodo>(
  alugueis: T[],
  competencia: string,
  regra: RegraCobrancaAluguel,
): T[] {
  const { primeiroDia, ultimoDia } = limitesDaCompetencia(competencia)

  if (regra === 'ABERTO_EM_QUALQUER_DIA') {
    return alugueis.filter(a => a.inicioEm <= ultimoDia && (!a.fimEm || a.fimEm >= primeiroDia))
  }

  return alugueis.filter(a => a.inicioEm <= primeiroDia && (!a.fimEm || a.fimEm >= primeiroDia))
}

/**
 * Soma em centavos e só então volta para reais.
 *
 * Somar 0.1 + 0.2 em ponto flutuante dá 0.30000000000000004; com três aluguéis
 * e uma mensalidade, a diferença aparece no total que o praticante confere.
 */
export function totalDasLinhas(linhas: Linha[]): number {
  const centavos = linhas.reduce((total, linha) => total + Math.round(linha.valor * 100), 0)
  return centavos / 100
}

export interface DadosDaCobranca {
  valorMensalidade: number
  /** Já filtradas para a competência, por `isencoesVigentesEm`. */
  isencoes: Isencao[]
  alugueis: Array<{ id: string, descricao: string, valorMensal: number }>
}

/** Zera a linha e escreve o motivo nela, em vez de fazê-la sumir. */
function comIsencao(linha: Linha, isencao: Isencao): Linha {
  const motivo = isencao.motivo.trim() || 'sem motivo registrado'
  return { ...linha, valor: 0, descricao: `${linha.descricao} (isenta: ${motivo})` }
}

/**
 * Monta as linhas do mês, aplicando as isenções conforme a abrangência de cada
 * uma: a gratuidade pode cobrir a mensalidade, o aluguel, ou tudo.
 *
 * A linha isenta continua aparecendo, zerada e com o motivo — assim a cobrança
 * explica a si mesma, em vez de o praticante ver um valor menor sem saber por quê.
 */
export function montarLinhas(dados: DadosDaCobranca): Linha[] {
  const isencaoDaMensalidade = isencaoQueCobre(dados.isencoes, 'MENSALIDADE')
  const isencaoDoAluguel = isencaoQueCobre(dados.isencoes, 'ALUGUEL')

  const mensalidade: Linha = {
    tipo: 'MENSALIDADE',
    descricao: 'Mensalidade',
    valor: dados.valorMensalidade,
  }

  const alugueis: Linha[] = dados.alugueis.map((a) => {
    const linha: Linha = {
      tipo: 'ALUGUEL',
      descricao: `Aluguel de ${a.descricao}`,
      valor: a.valorMensal,
      aluguelId: a.id,
    }
    return isencaoDoAluguel ? comIsencao(linha, isencaoDoAluguel) : linha
  })

  return [
    isencaoDaMensalidade ? comIsencao(mensalidade, isencaoDaMensalidade) : mensalidade,
    ...alugueis,
  ]
}

/**
 * A situação em que a cobrança nasce. Só é ISENTA quando havia isenção e não
 * sobrou nada a pagar — mensalidade zerada por falta de configuração não é
 * isenção, é clube que ainda não definiu o valor.
 */
export function situacaoInicial(linhas: Linha[], isencoes: Isencao[]): 'ABERTA' | 'ISENTA' {
  return isencoes.length > 0 && totalDasLinhas(linhas) === 0 ? 'ISENTA' : 'ABERTA'
}
