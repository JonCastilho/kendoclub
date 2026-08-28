import { randomBytes } from 'node:crypto'

/**
 * Cria a conta de acesso de um praticante.
 *
 * A senha nasce aleatória e nunca é mostrada a ninguém: quem define a senha é o
 * próprio praticante, pelo link de definição. Assim a diretoria não passa a
 * conhecer a senha de quem ela cadastra.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  const praticante = await prisma.praticante.findUnique({
    where: { id },
    include: { usuario: { select: { id: true } } },
  })

  if (!praticante) return responderErro(event, ['Praticante não encontrado.'], voltar)
  if (praticante.usuario) return responderErro(event, ['Este praticante já tem acesso.'], voltar)

  const email = praticante.email.trim().toLowerCase()
  if (!email) {
    return responderErro(event, ['O praticante precisa ter e-mail cadastrado.'], voltar)
  }

  // O e-mail de contato pode repetir entre irmãos, mas o de acesso é único.
  const jaUsado = await prisma.usuario.findUnique({ where: { email } })
  if (jaUsado) {
    return responderErro(
      event,
      [`Já existe conta com o e-mail ${email}. Cadastre outro e-mail para este praticante.`],
      voltar,
    )
  }

  const { token, hash } = gerarToken()

  await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email,
        // Senha impossível de adivinhar e que ninguém conhece — o acesso só
        // acontece depois que o praticante define a dele pelo link.
        senhaHash: await gerarHashDeSenha(randomBytes(32).toString('hex')),
        papel: 'PRATICANTE',
        praticanteId: id,
      },
    })

    await tx.tokenRedefinicaoSenha.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hash,
        expiraEm: new Date(Date.now() + VALIDADE_MS),
      },
    })
  })

  const { public: publico } = useRuntimeConfig()
  const link = `${publico.appUrl}/redefinir-senha?t=${token}`

  const enviado = await enviarEmail({
    para: email,
    assunto: `Seu acesso ao ${(await prisma.configuracaoClube.findUnique({ where: { id: 1 } }))?.nomeClube ?? 'clube'}`,
    texto: [
      'A diretoria criou seu acesso ao sistema do clube.',
      '',
      `Defina sua senha neste endereço: ${link}`,
      '',
      'O link vale por uma hora. Depois disso, use "Esqueci minha senha" na tela de entrada.',
    ].join('\n'),
  })

  // Sem SMTP configurado, o link volta para a tela: é a diretoria que o entrega
  // ao praticante. Sem isso, clube sem servidor de e-mail não conseguiria dar
  // acesso a ninguém.
  return responderSucesso(event, enviado ? voltar : `${voltar}?acessoLink=${encodeURIComponent(link)}`)
})
