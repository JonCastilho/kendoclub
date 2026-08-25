export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const prisma = usePrisma()

  const atual = await prisma.praticante.findUnique({
    where: { id },
    select: {
      consentimentoDadosEm: true,
      consentimentoSaudeEm: true,
      autorizacaoImagemEm: true,
      responsavelConsentimentoEm: true,
    },
  })

  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Praticante não encontrado.' })
  }

  const corpo = (await readBody(event)) ?? {}
  // As datas de consentimento anteriores são preservadas: reaceitar não deve
  // reescrever quando o consentimento foi dado.
  const { dados, problemas } = lerFormularioDoPraticante(corpo, atual)

  if (problemas.length > 0) {
    return responderErro(event, problemas, `/praticantes/${id}/editar`)
  }

  try {
    await prisma.praticante.update({ where: { id }, data: dados })
    return responderSucesso(event, `/praticantes/${id}`)
  }
  catch (erro) {
    const conflito = mensagemDeConflito(erro)
    if (conflito) return responderErro(event, [conflito], `/praticantes/${id}/editar`)
    throw erro
  }
})
