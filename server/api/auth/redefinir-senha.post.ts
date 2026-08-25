import { z } from 'zod'
// Import explícito: o Nuxt auto-importa server/utils/, mas na pasta shared/ só
// alcança shared/utils/ e shared/types/ — arquivos na raiz dela, não.
import { senhaAceita } from '~~/shared/senha'

const esquema = z.object({
  token: z.string().min(1).max(300),
  senha: z.string().max(200),
  confirmacao: z.string().max(200),
})

export default defineEventHandler(async (event) => {
  const dados = esquema.safeParse((await readBody(event)) ?? {})

  if (!dados.success) {
    return sendRedirect(event, '/redefinir-senha?erro=dados', 303)
  }

  const { token, senha, confirmacao } = dados.data
  const voltar = (erro: string) =>
    sendRedirect(event, `/redefinir-senha?t=${encodeURIComponent(token)}&erro=${erro}`, 303)

  if (senha !== confirmacao) return voltar('confirmacao')
  if (!senhaAceita(senha)) return voltar('fraca')

  const prisma = usePrisma()
  const registro = await prisma.tokenRedefinicaoSenha.findUnique({
    where: { tokenHash: hashDoToken(token) },
  })

  if (!registro || registro.usadoEm || registro.expiraEm < new Date()) {
    return sendRedirect(event, '/esqueci-senha?erro=expirado', 303)
  }

  // A troca de senha e a baixa do token andam juntas: se uma falhasse sozinha,
  // ou o token continuaria valendo, ou a senha mudaria sem registro.
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { senhaHash: await gerarHashDeSenha(senha) },
    }),
    prisma.tokenRedefinicaoSenha.update({
      where: { id: registro.id },
      data: { usadoEm: new Date() },
    }),
    // Pedidos anteriores do mesmo usuário perdem a validade: se alguém pediu
    // redefinição duas vezes, o link antigo não pode continuar de pé.
    prisma.tokenRedefinicaoSenha.deleteMany({
      where: { usuarioId: registro.usuarioId, usadoEm: null },
    }),
  ])

  // Nota: a sessão é um cookie selado, sem registro no servidor, então uma
  // sessão já aberta em outro dispositivo continua válida até expirar. Encerrar
  // todas exigiria guardar sessão no banco — decisão para quando houver motivo.
  return sendRedirect(event, '/entrar?redefinida=1', 303)
})
