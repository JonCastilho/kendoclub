import { z } from 'zod'

const esquema = z.object({
  email: z.string().max(200).transform(v => v.trim().toLowerCase()),
})

export default defineEventHandler(async (event) => {
  const dados = esquema.safeParse(await readBody(event))

  // A resposta é sempre a mesma, com ou sem cadastro: se dissesse "e-mail não
  // encontrado", esta tela viraria um consultor gratuito de quem é do clube.
  const respostaUnica = () => sendRedirect(event, '/esqueci-senha?enviado=1', 303)

  if (!dados.success) return respostaUnica()

  const prisma = usePrisma()
  const usuario = await prisma.usuario.findUnique({ where: { email: dados.data.email } })

  if (!usuario || !usuario.ativo) return respostaUnica()

  const { token, hash } = gerarToken()

  await prisma.tokenRedefinicaoSenha.create({
    data: {
      usuarioId: usuario.id,
      tokenHash: hash,
      expiraEm: new Date(Date.now() + VALIDADE_MS),
    },
  })

  const { public: publico } = useRuntimeConfig()
  const link = `${publico.appUrl}/redefinir-senha?t=${token}`

  await enviarEmail({
    para: usuario.email,
    assunto: 'Redefinição de senha - KendoClub',
    texto: [
      'Recebemos um pedido para redefinir a senha da sua conta.',
      '',
      `Abra este endereço para escolher uma nova senha: ${link}`,
      '',
      'O link vale por uma hora e só pode ser usado uma vez.',
      'Se não foi você que pediu, ignore esta mensagem: nada muda.',
    ].join('\n'),
  })

  return respostaUnica()
})
