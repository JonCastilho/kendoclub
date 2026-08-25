import { interpretarValor } from '~~/shared/dinheiro'

const SITUACOES = ['DISPONIVEL', 'MANUTENCAO', 'BAIXADO'] as const

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const voltar = '/itens'
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const nome = texto(corpo.nome)
  const valor = interpretarValor(texto(corpo.valorMensalAluguel) || '0')
  const situacaoInformada = texto(corpo.situacao)
  const situacao = SITUACOES.includes(situacaoInformada as typeof SITUACOES[number])
    ? situacaoInformada as typeof SITUACOES[number]
    : 'DISPONIVEL'

  const problemas: string[] = []
  if (!nome) problemas.push('Informe o nome do item.')
  if (valor === null) problemas.push('Valor de aluguel inválido.')

  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const dados = {
    nome,
    identificador: opcional(corpo.identificador),
    tipo: opcional(corpo.tipo),
    situacao,
    valorMensalAluguel: valor!,
    observacoes: opcional(corpo.observacoes),
  }

  if (id) {
    await prisma.item.update({ where: { id }, data: dados })
    return responderSucesso(event, `/itens/${id}`)
  }

  const criado = await prisma.item.create({ data: dados, select: { id: true } })
  return responderSucesso(event, `/itens/${criado.id}`)
})
