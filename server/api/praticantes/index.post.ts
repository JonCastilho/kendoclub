export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const { dados, problemas } = lerFormularioDoPraticante(corpo)

  // A data de filiação é informada e pode ser retroativa: o primeiro uso do
  // sistema é cadastrar quem já treina há anos.
  const inicioFiliacao = dataUtc(corpo.filiacaoInicioEm)
  if (!inicioFiliacao) problemas.push('Informe a data de filiação.')
  else if (inicioFiliacao > new Date()) problemas.push('A filiação não pode começar no futuro.')

  if (problemas.length > 0) {
    return responderErro(event, problemas, '/praticantes/novo')
  }

  const prisma = usePrisma()

  try {
    const criado = await prisma.praticante.create({
      data: {
        ...dados,
        filiacoes: { create: { inicioEm: inicioFiliacao! } },
      },
      select: { id: true },
    })

    return responderSucesso(event, `/praticantes/${criado.id}`)
  }
  catch (erro) {
    const conflito = mensagemDeConflito(erro)
    if (conflito) return responderErro(event, [conflito], '/praticantes/novo')
    throw erro
  }
})
