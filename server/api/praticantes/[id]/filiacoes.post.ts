import { periodoConflita, periodoValido } from '~~/shared/filiacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = await readBody(event)
  const voltar = `/praticantes/${id}`

  const prisma = usePrisma()
  const filiacoes = await prisma.filiacao.findMany({ where: { praticanteId: id } })

  if (texto(corpo.acao) === 'encerrar') {
    const filiacaoId = texto(corpo.filiacaoId)
    const fimEm = dataUtc(corpo.fimEm)
    const alvo = filiacoes.find(f => f.id === filiacaoId)

    if (!alvo) return responderErro(event, ['Filiação não encontrada.'], voltar)
    if (!fimEm) return responderErro(event, ['Informe a data de saída.'], voltar)
    if (!periodoValido({ inicioEm: alvo.inicioEm, fimEm })) {
      return responderErro(event, ['A saída precisa ser depois da entrada.'], voltar)
    }

    await prisma.filiacao.update({
      where: { id: filiacaoId },
      data: { fimEm, motivoSaida: opcional(corpo.motivoSaida) },
    })

    return responderSucesso(event, voltar)
  }

  const inicioEm = dataUtc(corpo.inicioEm)
  if (!inicioEm) return responderErro(event, ['Informe a data de filiação.'], voltar)

  // Períodos que se cruzam tornariam "desde quando é do clube" uma pergunta com
  // duas respostas. A data é digitada à mão e pode ser retroativa, então a
  // colisão é um erro provável, não hipotético.
  if (periodoConflita({ inicioEm }, filiacoes)) {
    return responderErro(
      event,
      ['Este período se sobrepõe a uma filiação já registrada.'],
      voltar,
    )
  }

  try {
    await prisma.filiacao.create({ data: { praticanteId: id, inicioEm } })
    return responderSucesso(event, voltar)
  }
  catch (erro) {
    const conflito = mensagemDeConflito(erro)
    if (conflito) return responderErro(event, [conflito], voltar)
    throw erro
  }
})
