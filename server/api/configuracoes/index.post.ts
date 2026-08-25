import { interpretarValor } from '~~/shared/dinheiro'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = await readBody(event)
  const voltar = '/configuracoes'

  const nomeClube = texto(corpo.nomeClube)
  const valorMensalidade = interpretarValor(texto(corpo.valorMensalidade) || '0')
  const valorAluguelPadrao = interpretarValor(texto(corpo.valorAluguelPadrao) || '0')
  const diaVencimento = Number(texto(corpo.diaVencimento))

  const problemas: string[] = []
  if (!nomeClube) problemas.push('Informe o nome do clube.')
  if (valorMensalidade === null) problemas.push('Valor da mensalidade inválido.')
  if (valorAluguelPadrao === null) problemas.push('Valor padrão de aluguel inválido.')
  // Dia 29, 30 e 31 não existem em todo mês; o vencimento cai no último dia
  // quando faltar — ver vencimentoDa, em shared/competencia.ts.
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
    problemas.push('O dia de vencimento vai de 1 a 31.')
  }

  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const dados = {
    nomeClube,
    emailContato: opcional(corpo.emailContato),
    chavePix: opcional(corpo.chavePix),
    titularPix: opcional(corpo.titularPix),
    valorMensalidade: valorMensalidade!,
    valorAluguelPadrao: valorAluguelPadrao!,
    diaVencimento,
  }

  const prisma = usePrisma()
  await prisma.configuracaoClube.upsert({
    where: { id: 1 },
    update: dados,
    create: { id: 1, ...dados },
  })

  return responderSucesso(event, voltar)
})
