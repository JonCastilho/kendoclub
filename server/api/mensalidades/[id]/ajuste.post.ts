export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const mensalidade = await prisma.mensalidade.findUnique({ where: { id } })
  if (!mensalidade) {
    throw createError({ statusCode: 404, statusMessage: 'Mensalidade não encontrada.' })
  }

  const voltar = `/mensalidades?competencia=${mensalidade.competencia}`
  const acao = texto(corpo.acao)

  /// Toda alteração fora do fluxo normal fica escrita na própria cobrança.
  const carimbo = (texto_: string) =>
    [mensalidade.observacao, `${texto_} por ${usuario.email} em ${new Date().toLocaleString('pt-BR')}.`]
      .filter(Boolean).join(' ')

  if (acao === 'cancelar') {
    if (mensalidade.situacao === 'PAGA') {
      return responderErro(event, ['Cobrança paga não pode ser cancelada. Estorne a baixa antes.'], voltar)
    }
    if (mensalidade.situacao === 'CANCELADA') {
      return responderErro(event, ['Esta cobrança já está cancelada.'], voltar)
    }

    await prisma.mensalidade.update({
      where: { id },
      data: { situacao: 'CANCELADA', observacao: carimbo('Cancelada') },
    })

    return responderSucesso(event, voltar)
  }

  if (acao === 'reabrir') {
    if (mensalidade.situacao !== 'CANCELADA') {
      return responderErro(event, ['Só cobrança cancelada pode ser reaberta.'], voltar)
    }

    // Volta como aberta e em seguida recalcula, para refletir o estado atual —
    // o motivo de ter sido cancelada costuma ser justamente uma correção.
    await prisma.mensalidade.update({
      where: { id },
      data: { situacao: 'ABERTA', observacao: carimbo('Reaberta') },
    })

    const problemas = await recalcularMensalidade(id)
    return problemas.length > 0
      ? responderErro(event, problemas, voltar)
      : responderSucesso(event, voltar)
  }

  const problemas = await recalcularMensalidade(id)
  return problemas.length > 0
    ? responderErro(event, problemas, voltar)
    : responderSucesso(event, voltar)
})
