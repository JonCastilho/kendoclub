import { formatarCompetencia, vencimentoDa } from './competencia'
import { declaracaoPendente, type Declaracao } from './declaracao'
import { formatarReais } from './dinheiro'
import { diaDe } from './evento'

/**
 * Lembrete de mensalidade em atraso, por e-mail.
 *
 * É a única cobrança que avisa por e-mail: evento, exame e o resto aparecem na
 * tela, mas ninguém recebe mensagem por causa deles (decisão da diretoria, em
 * PLANO.md). Tudo o que decide quem recebe o quê mora aqui, puro, para poder ser
 * testado sem banco, sem servidor de e-mail e sem esperar o relógio andar.
 *
 * Datas de calendário são texto AAAA-MM-DD: dia é dia, e comparar texto ISO
 * dispensa conversão de fuso.
 */

/** Quantos dias depois da data de referência cada lembrete sai. */
export const MARCOS_DO_LEMBRETE = [15, 30] as const

export type MarcoDoLembrete = (typeof MARCOS_DO_LEMBRETE)[number]

/**
 * Por quantos dias um marco continua valendo.
 *
 * Existe para duas coisas. O app pode ficar fora do ar no dia exato e o
 * lembrete ainda sai quando voltar. E, na primeira vez que o agendador roda,
 * quem já devia há meses não recebe uma enxurrada de avisos atrasados: passou
 * da janela do último marco, o sistema para.
 */
export const JANELA_DO_MARCO = 15

// ------------------------------------------------------------- dia de pagamento

export const PROBLEMA_DO_DIA_DE_PAGAMENTO = 'O dia de pagamento vai de 1 a 31.'

/**
 * Lê o dia do formulário. Vazio é válido e quer dizer "o dia do clube".
 * Sem conversão frouxa: "10abc" ou "1e1" não viram 10 por simpatia.
 */
export function lerDiaDePagamento(entrada: string): { dia: number | null, problema: string | null } {
  const texto = entrada.trim()
  if (texto === '') return { dia: null, problema: null }

  const dia = /^\d{1,2}$/.test(texto) ? Number(texto) : Number.NaN
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    return { dia: null, problema: PROBLEMA_DO_DIA_DE_PAGAMENTO }
  }
  return { dia, problema: null }
}

// ------------------------------------------------------------ datas e atraso

/**
 * Data a partir da qual se conta o atraso: o dia de pagamento combinado na
 * competência, ou o vencimento da cobrança quando não há dia combinado.
 *
 * Nunca é anterior ao vencimento. Quem combinou pagar no dia 5 num clube que
 * vence no dia 10 não pode receber um "em atraso" de cobrança que ainda nem
 * venceu. Dia que não existe no mês (31 em fevereiro) cai no último dia dele.
 */
export function dataDeReferencia(
  vencimento: string,
  competencia: string,
  diaDePagamento: number | null,
): string {
  if (diaDePagamento === null) return vencimento

  const combinada = diaDe(vencimentoDa(competencia, diaDePagamento))
  return combinada > vencimento ? combinada : vencimento
}

const DIA_EM_MS = 86_400_000

/** Dias de calendário entre a referência e hoje. Negativo se ainda não chegou. */
export function diasDeAtraso(referencia: string, hoje: string): number {
  const diferenca = Date.parse(`${hoje}T00:00:00.000Z`) - Date.parse(`${referencia}T00:00:00.000Z`)
  return Math.round(diferenca / DIA_EM_MS)
}

/**
 * O lembrete que cabe no atraso de hoje, ou null.
 *
 * Só o marco da janela atual conta: quem está no 35º dia recebe o de 30, e o
 * de 15 — que não saiu a tempo — fica para trás em vez de chegar junto. Marco
 * já enviado não se repete.
 */
export function marcoDevido(atraso: number, jaEnviados: number[]): MarcoDoLembrete | null {
  for (const marco of [...MARCOS_DO_LEMBRETE].reverse()) {
    if (atraso >= marco && atraso < marco + JANELA_DO_MARCO) {
      return jaEnviados.includes(marco) ? null : marco
    }
  }
  return null
}

// ----------------------------------------------------------------- o plano

/** O que a consulta traz de cada mensalidade; as regras abaixo decidem o resto. */
export interface MensalidadeParaLembrar {
  id: string
  competencia: string
  /** Dia do vencimento da cobrança, AAAA-MM-DD. */
  vencimento: string
  valorTotal: number | string
  situacao: string
  declaracoes: Declaracao[]
  /** Marcos já enviados para esta mensalidade. */
  enviados: number[]
  praticante: {
    id: string
    nomeCompleto: string
    email: string
    diaDePagamento: number | null
    temAcesso: boolean
  }
}

export interface ItemDoLembrete {
  mensalidadeId: string
  competencia: string
  valor: number
  /** Data a partir da qual o atraso foi contado. */
  referencia: string
  atraso: number
  marco: MarcoDoLembrete
}

/** Um e-mail: tudo o que uma pessoa deve receber de uma vez. */
export interface LembreteDevido {
  praticanteId: string
  nome: string
  email: string
  diaDePagamento: number | null
  temAcesso: boolean
  itens: ItemDoLembrete[]
}

/**
 * Quem deve receber lembrete hoje, com um e-mail por pessoa.
 *
 * Fica de fora, mesmo atrasada: cobrança paga, isenta ou cancelada, de valor
 * zero, com aviso de pagamento ainda não conferido (a pessoa já fez a parte
 * dela e a bola está com a diretoria) e quem não tem e-mail cadastrado.
 *
 * Agrupar por pessoa evita que quem deve dois meses receba dois e-mails no
 * mesmo dia.
 */
export function planejarLembretes(
  mensalidades: MensalidadeParaLembrar[],
  hoje: string,
): LembreteDevido[] {
  const porPessoa = new Map<string, LembreteDevido>()

  for (const m of mensalidades) {
    if (m.situacao !== 'ABERTA') continue
    if (!(Number(m.valorTotal) > 0)) continue
    if (declaracaoPendente(m.declaracoes)) continue

    const email = m.praticante.email.trim()
    if (!email) continue

    const referencia = dataDeReferencia(m.vencimento, m.competencia, m.praticante.diaDePagamento)
    const atraso = diasDeAtraso(referencia, hoje)
    const marco = marcoDevido(atraso, m.enviados)
    if (marco === null) continue

    const lembrete = porPessoa.get(m.praticante.id) ?? {
      praticanteId: m.praticante.id,
      nome: m.praticante.nomeCompleto,
      email,
      diaDePagamento: m.praticante.diaDePagamento,
      temAcesso: m.praticante.temAcesso,
      itens: [],
    }

    lembrete.itens.push({
      mensalidadeId: m.id,
      competencia: m.competencia,
      valor: Number(m.valorTotal),
      referencia,
      atraso,
      marco,
    })
    porPessoa.set(m.praticante.id, lembrete)
  }

  const plano = [...porPessoa.values()]
  for (const lembrete of plano) {
    lembrete.itens.sort((a, b) => a.competencia.localeCompare(b.competencia))
  }
  return plano.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ------------------------------------------------------------------ o e-mail

/** '2026-11-20' → '20/11/2026' */
function dataBrasileira(dia: string): string {
  const [ano, mes, numero] = dia.split('-')
  return `${numero}/${mes}/${ano}`
}

const pluralDeDias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

export interface DadosDoEmail {
  nomeClube: string
  nome: string
  diaDePagamento: number | null
  itens: ItemDoLembrete[]
  /** Endereço da tela de mensalidades; nulo para quem não tem acesso ao sistema. */
  link: string | null
}

/**
 * O texto do lembrete. Diz o que está em aberto, desde quando e como resolver,
 * sem tom de cobrança: é um aviso entre pessoas do mesmo clube.
 */
export function montarEmailDeLembrete(dados: DadosDoEmail): { assunto: string, texto: string } {
  const primeiroNome = dados.nome.trim().split(/\s+/)[0] ?? ''
  const plural = dados.itens.length > 1

  const linhas = dados.itens.map(i =>
    `- ${formatarCompetencia(i.competencia)}: ${formatarReais(i.valor)}, `
    + `para pagar até ${dataBrasileira(i.referencia)} (${pluralDeDias(i.atraso)} de atraso)`)

  const texto = [
    `Olá, ${primeiroNome}.`,
    '',
    plural
      ? `Estas mensalidades do ${dados.nomeClube} seguem em aberto:`
      : `Esta mensalidade do ${dados.nomeClube} segue em aberto:`,
    '',
    ...linhas,
    '',
    ...(dados.diaDePagamento
      ? [`Você combinou pagar no dia ${dados.diaDePagamento} de cada mês.`, '']
      : []),
    dados.link
      ? `Veja os valores e a forma de pagamento em ${dados.link}. Se você já pagou, avise a diretoria por lá.`
      : 'Procure a diretoria para acertar o pagamento. Se você já pagou, avise-a.',
    '',
    'Se o pagamento já foi feito e confirmado, desconsidere esta mensagem.',
  ].join('\n')

  return { assunto: `${plural ? 'Mensalidades' : 'Mensalidade'} em atraso - ${dados.nomeClube}`, texto }
}
