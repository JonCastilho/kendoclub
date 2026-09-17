import type { Grau } from '@prisma/client'
import {
  ROTULO_DO_SHOGO,
  type Shogo,
  grausDaModalidade,
  ordemDoGrau,
  rotuloDaGraduacao,
} from './graduacao'

/**
 * Regras do exame (etapa 7.3). Motivos em PLANO.md, etapa 7.
 *
 * O que a pessoa presta não é perguntado: sai do grau e dos títulos no cadastro.
 * A carência avisa a diretoria, mas não impede a inscrição.
 */

/**
 * Graduações com banca num exame, e portanto as que têm carência: 1º kyu
 * (destino de todo aspirante) e os dans.
 */
export const GRAUS_DE_EXAME: Grau[] = [
  'KYU_1', 'DAN_1', 'DAN_2', 'DAN_3', 'DAN_4', 'DAN_5', 'DAN_6', 'DAN_7', 'DAN_8',
]

export const SHOGOS: Shogo[] = ['RENSHI', 'KYOSHI']

/** Abaixo do 2º kyu — 3º kyu para baixo, e mukyu. */
export function ehAspirante(grau: Grau | null): boolean {
  return grau === null || ordemDoGrau(grau) < ordemDoGrau('KYU_2')
}

/**
 * Graduação que a pessoa presta no exame de dan.
 *
 * Sempre a seguinte à atual, com uma exceção: aspirante vai direto ao 1º kyu.
 * Quem está no 2º kyu também vai ao 1º kyu, por ser o seguinte. Devolve nulo
 * para o 8º dan.
 */
export function grauPretendido(atual: Grau | null, kyuInicial: number): Grau | null {
  if (ehAspirante(atual) || atual === 'KYU_2') return 'KYU_1'

  const graus = grausDaModalidade(kyuInicial)
  return graus[graus.indexOf(atual!) + 1] ?? null
}

/** Renshi a partir do 5º dan. */
export const DAN_MINIMO_PARA_RENSHI: Grau = 'DAN_5'

/**
 * Shogo que a pessoa pode prestar: Renshi para 5º dan ou acima, ainda sem
 * título; Kyoshi para quem tem Renshi. Nulo para quem não está liberado.
 */
export function shogoPretendido(atual: Grau | null, shogos: Shogo[]): Shogo | null {
  if (shogos.includes('KYOSHI')) return null
  if (shogos.includes('RENSHI')) return 'KYOSHI'
  if (atual && ordemDoGrau(atual) >= ordemDoGrau(DAN_MINIMO_PARA_RENSHI)) return 'RENSHI'
  return null
}

/**
 * Problemas ao registrar um shogo no cadastro. Kyoshi pede Renshi anterior;
 * Renshi pede 5º dan.
 */
export function problemasDoShogoDoPraticante(dados: {
  shogo: string
  obtidoEm: string | null
  grau: Grau | null
  renshiEm: string | null
  hoje: string
}): string[] {
  const problemas: string[] = []

  if (!SHOGOS.includes(dados.shogo as Shogo)) problemas.push('Escolha Renshi ou Kyoshi.')
  else if (dados.shogo === 'RENSHI'
    && (!dados.grau || ordemDoGrau(dados.grau) < ordemDoGrau(DAN_MINIMO_PARA_RENSHI))) {
    problemas.push('Renshi pede 5º dan ou acima. Registre a graduação antes.')
  }
  else if (dados.shogo === 'KYOSHI' && !dados.renshiEm) {
    problemas.push('Kyoshi pede Renshi. Registre o Renshi antes.')
  }

  if (!dados.obtidoEm) problemas.push('Informe a data em que o título foi obtido.')
  else if (dados.obtidoEm > dados.hoje) problemas.push('O título não pode ter data no futuro.')
  else if (dados.shogo === 'KYOSHI' && dados.renshiEm && dados.obtidoEm < dados.renshiEm) {
    problemas.push('O Kyoshi não pode ser anterior ao Renshi.')
  }

  return problemas
}

export interface OpcoesDeExame {
  grau: Grau | null
  temBancaDeGrau: boolean
  shogo: Shogo | null
  temBancaDeShogo: boolean
}

/** O que a pessoa pode prestar, a partir do cadastro e das bancas do exame. */
export function opcoesDeExame(
  atual: { grau: Grau | null, shogos: Shogo[] },
  kyuInicial: number,
  bancas: { graduacoes: Array<{ grau: Grau }>, shogos: Array<{ shogo: Shogo }> },
): OpcoesDeExame {
  const grau = grauPretendido(atual.grau, kyuInicial)
  const shogo = shogoPretendido(atual.grau, atual.shogos)
  return {
    grau,
    temBancaDeGrau: grau !== null && bancas.graduacoes.some(g => g.grau === grau),
    shogo,
    temBancaDeShogo: shogo !== null && bancas.shogos.some(s => s.shogo === shogo),
  }
}

/**
 * Decide o que a pessoa presta no exame.
 *
 * Só pergunta quando há escolha: se dá para prestar dan e shogo, a pessoa
 * marca um, outro ou os dois; se só um dos dois tem banca, é ele. Sem banca
 * nenhuma, a recusa diz o que faltou — e não um erro genérico.
 */
export function decidirExame(
  opcoes: OpcoesDeExame,
  marcou: { grau: boolean, shogo: boolean },
  nomeDoExame: string,
): { grau: Grau | null, shogo: Shogo | null, problemas: string[] } {
  const podeGrau = opcoes.temBancaDeGrau
  const podeShogo = opcoes.temBancaDeShogo

  if (podeGrau && podeShogo) {
    if (!marcou.grau && !marcou.shogo) {
      return { grau: null, shogo: null, problemas: [
        `Em ${nomeDoExame}, marque o exame de ${rotuloDaGraduacao(opcoes.grau)}, `
        + `o de ${ROTULO_DO_SHOGO[opcoes.shogo!]} ou os dois.`,
      ] }
    }
    return {
      grau: marcou.grau ? opcoes.grau : null,
      shogo: marcou.shogo ? opcoes.shogo : null,
      problemas: [],
    }
  }

  if (podeGrau) return { grau: opcoes.grau, shogo: null, problemas: [] }
  if (podeShogo) return { grau: null, shogo: opcoes.shogo, problemas: [] }

  const semBanca = [
    opcoes.grau ? rotuloDaGraduacao(opcoes.grau) : null,
    opcoes.shogo ? ROTULO_DO_SHOGO[opcoes.shogo] : null,
  ].filter(Boolean)

  if (semBanca.length === 0) {
    return { grau: null, shogo: null, problemas: [
      `Em ${nomeDoExame}: este cadastro já está na graduação e no título máximos.`,
    ] }
  }
  return { grau: null, shogo: null, problemas: [
    `Em ${nomeDoExame}: não haverá banca para ${semBanca.join(' nem para ')}, `
    + 'que é o que este cadastro pode prestar.',
  ] }
}

/** '2024-01-31' + 1 mês = '2024-02-29': dia que não existe cai no último do mês. */
export function somarMeses(dia: string, meses: number): string {
  const [ano, mes, numero] = dia.split('-').map(Number) as [number, number, number]
  const total = ano * 12 + (mes - 1) + meses
  const anoFinal = Math.floor(total / 12)
  const mesFinal = total % 12
  const ultimoDia = new Date(Date.UTC(anoFinal, mesFinal + 1, 0)).getUTCDate()

  return new Date(Date.UTC(anoFinal, mesFinal, Math.min(numero, ultimoDia)))
    .toISOString().slice(0, 10)
}

export type AvisoDeCarencia =
  | { tipo: 'DATA_DESCONHECIDA' }
  | { tipo: 'NAO_CUMPRIDA', cumpreEm: string }

/**
 * Carência para a graduação pretendida, contada até o primeiro dia do exame.
 *
 * `referencia` é a data da última graduação — ou, para mukyu, a data em que
 * começou na modalidade, já que nunca se graduou. Sem regra na tabela, não há
 * aviso: a tabela nasce vazia e o clube preenche o que usa.
 */
export function avisoDeCarencia(dados: {
  referencia: string | null
  mesesMinimos: number | null
  diaDoExame: string
}): AvisoDeCarencia | null {
  if (dados.mesesMinimos === null) return null
  if (!dados.referencia) return { tipo: 'DATA_DESCONHECIDA' }

  const cumpreEm = somarMeses(dados.referencia, dados.mesesMinimos)
  return cumpreEm > dados.diaDoExame ? { tipo: 'NAO_CUMPRIDA', cumpreEm } : null
}

/** Mensagem do aviso, para a lista de inscritos. */
export function textoDoAviso(aviso: AvisoDeCarencia): string {
  if (aviso.tipo === 'DATA_DESCONHECIDA') {
    return 'carência não conferida: data da última graduação desconhecida'
  }
  const [ano, mes, dia] = aviso.cumpreEm.split('-')
  return `carência não cumprida: só em ${dia}/${mes}/${ano}`
}

/** Meses de carência vindos do formulário: vazio tira a regra, lixo é NaN. */
export function lerMeses(bruto: string): number | null {
  const limpo = bruto.trim()
  if (!limpo) return null
  return /^\d+$/.test(limpo) ? Number(limpo) : Number.NaN
}

export function problemasDoShogoOferecido(dados: { shogo: string, valor: number | null }): string[] {
  const problemas: string[] = []
  if (!SHOGOS.includes(dados.shogo as Shogo)) problemas.push('Escolha Renshi ou Kyoshi.')
  if (dados.valor === null) problemas.push('Informe o valor do exame. Use 0 se for gratuito.')
  return problemas
}

export function problemasDaGraduacaoOferecida(
  dados: { grau: string, valor: number | null },
  kyuInicial: number,
): string[] {
  const problemas: string[] = []

  if (!GRAUS_DE_EXAME.includes(dados.grau as Grau)
    || !grausDaModalidade(kyuInicial).includes(dados.grau as Grau)) {
    problemas.push('Escolha uma graduação de exame desta modalidade: 1º kyu ou um dan.')
  }
  if (dados.valor === null) problemas.push('Informe o valor do exame. Use 0 se for gratuito.')

  return problemas
}
