import { descricaoDoAluguel } from '~~/shared/aluguel'
import { vencimentoDa } from '~~/shared/competencia'
import {
  type Linha,
  alugueisDaCompetencia,
  deveGerarPara,
  isencoesVigentesEm,
  montarLinhas,
  situacaoInicial,
  totalDasLinhas,
} from '~~/shared/cobranca'

export interface ResultadoDaGeracao {
  competencia: string
  criadas: number
  isentas: number
  jaExistiam: number
  semCobranca: number
}

interface ConfiguracaoDeCobranca {
  valorMensalidade: number
  diaVencimento: number
  regra: 'ABERTO_NO_PRIMEIRO_DIA' | 'ABERTO_EM_QUALQUER_DIA'
}

async function lerConfiguracao(): Promise<ConfiguracaoDeCobranca> {
  const clube = await usePrisma().configuracaoClube.findUnique({ where: { id: 1 } })

  return {
    valorMensalidade: Number(clube?.valorMensalidade ?? 0),
    diaVencimento: clube?.diaVencimento ?? 10,
    regra: clube?.regraCobrancaAluguel ?? 'ABERTO_NO_PRIMEIRO_DIA',
  }
}

/** O que precisa ser lido do praticante para calcular a cobrança dele. */
const paraCalcular = {
  filiacoes: { select: { inicioEm: true, fimEm: true } },
  isencoes: { select: { inicioEm: true, fimEm: true, motivo: true, abrangencia: true } },
  alugueis: {
    select: {
      id: true,
      inicioEm: true,
      fimEm: true,
      valorMensal: true,
      descricao: true,
      item: { select: { nome: true, identificador: true } },
    },
  },
} as const

type PraticanteParaCalculo = {
  filiacoes: Array<{ inicioEm: Date, fimEm: Date | null }>
  isencoes: Array<{ inicioEm: Date, fimEm: Date | null, motivo: string, abrangencia: 'MENSALIDADE' | 'ALUGUEL' | 'TUDO' }>
  alugueis: Array<{
    id: string
    inicioEm: Date
    fimEm: Date | null
    valorMensal: unknown
    descricao: string | null
    item: { nome: string, identificador: string | null } | null
  }>
}

/**
 * Calcula a cobrança de um praticante numa competência, ou devolve null quando
 * não deve haver cobrança (não estava filiado no primeiro dia do mês).
 *
 * Geração e recálculo passam por aqui — se fossem dois cálculos, um dia
 * discordariam, e a diferença apareceria como centavos inexplicáveis.
 */
function calcularCobranca(
  praticante: PraticanteParaCalculo,
  competencia: string,
  config: ConfiguracaoDeCobranca,
): { linhas: Linha[], total: number, situacao: 'ABERTA' | 'ISENTA' } | null {
  if (!deveGerarPara(praticante.filiacoes, competencia)) return null

  const isencoes = isencoesVigentesEm(praticante.isencoes, competencia)

  const alugueis = alugueisDaCompetencia(praticante.alugueis, competencia, config.regra)
    .map(a => ({
      id: a.id,
      descricao: descricaoDoAluguel(a),
      valorMensal: Number(a.valorMensal),
    }))

  const linhas = montarLinhas({ valorMensalidade: config.valorMensalidade, isencoes, alugueis })

  return { linhas, total: totalDasLinhas(linhas), situacao: situacaoInicial(linhas, isencoes) }
}

function paraCriar(linhas: Linha[]) {
  return linhas.map(l => ({
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    aluguelId: l.aluguelId ?? null,
  }))
}

/**
 * Gera as mensalidades de uma competência.
 *
 * É idempotente: rodar de novo não duplica, porque o banco tem unicidade em
 * (praticanteId, competencia) e porque as já existentes são contadas e puladas.
 * Isso importa — "gerar o mês" é o botão que alguém vai clicar duas vezes.
 */
export async function gerarMensalidades(competencia: string): Promise<ResultadoDaGeracao> {
  const prisma = usePrisma()
  const config = await lerConfiguracao()

  const praticantes = await prisma.praticante.findMany({
    include: { ...paraCalcular, mensalidades: { where: { competencia }, select: { id: true } } },
  })

  const vencimento = vencimentoDa(competencia, config.diaVencimento)
  const resultado: ResultadoDaGeracao = {
    competencia, criadas: 0, isentas: 0, jaExistiam: 0, semCobranca: 0,
  }

  for (const praticante of praticantes) {
    if (praticante.mensalidades.length > 0) {
      resultado.jaExistiam += 1
      continue
    }

    const cobranca = calcularCobranca(praticante, competencia, config)
    if (!cobranca) {
      resultado.semCobranca += 1
      continue
    }

    await prisma.mensalidade.create({
      data: {
        praticanteId: praticante.id,
        competencia,
        vencimento,
        valorTotal: cobranca.total,
        situacao: cobranca.situacao,
        linhas: { create: paraCriar(cobranca.linhas) },
      },
    })

    resultado.criadas += 1
    if (cobranca.situacao === 'ISENTA') resultado.isentas += 1
  }

  return resultado
}

/**
 * Refaz as linhas de uma cobrança a partir do estado atual do praticante.
 *
 * A geração é um retrato do mês: isenção concedida ou aluguel registrado depois
 * dela não mudam sozinhos a cobrança já emitida. Sem esta função, a saída seria
 * corrigir no banco à mão — que é como clube pequeno perde o controle do
 * próprio histórico.
 *
 * Devolve a lista de impedimentos; vazia significa que recalculou.
 */
export async function recalcularMensalidade(id: string): Promise<string[]> {
  const prisma = usePrisma()

  const mensalidade = await prisma.mensalidade.findUnique({
    where: { id },
    include: { praticante: { include: paraCalcular } },
  })

  if (!mensalidade) return ['Mensalidade não encontrada.']

  // Cobrança paga não se recalcula: o valor pago já foi conferido contra o que
  // estava emitido. Para mexer, estorne primeiro — e isso fica registrado.
  if (mensalidade.situacao === 'PAGA') {
    return ['Cobrança paga não pode ser recalculada. Estorne a baixa antes.']
  }
  if (mensalidade.situacao === 'CANCELADA') {
    return ['Cobrança cancelada não pode ser recalculada. Reabra antes.']
  }

  const config = await lerConfiguracao()
  const cobranca = calcularCobranca(mensalidade.praticante, mensalidade.competencia, config)

  if (!cobranca) {
    return [
      'Este praticante não estava filiado no primeiro dia da competência, '
      + 'então não deveria ter cobrança. Cancele-a.',
    ]
  }

  // Apagar e recriar as linhas, em vez de conciliar uma a uma: a cobrança é um
  // retrato, e meio-retrato não existe.
  await prisma.$transaction([
    prisma.linhaMensalidade.deleteMany({ where: { mensalidadeId: id } }),
    prisma.mensalidade.update({
      where: { id },
      data: {
        valorTotal: cobranca.total,
        situacao: cobranca.situacao,
        vencimento: vencimentoDa(mensalidade.competencia, config.diaVencimento),
        linhas: { create: paraCriar(cobranca.linhas) },
      },
    }),
  ])

  return []
}
