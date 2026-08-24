import { randomBytes } from 'node:crypto'
import { z } from 'zod'

const esquema = z.object({
  email: z.string().max(200).transform(v => v.trim().toLowerCase()),
  senha: z.string().max(200),
  destino: z.string().max(300).optional(),
})

/**
 * Hash de uma senha aleatória, gerado uma vez por processo.
 *
 * Quando o e-mail não existe, verificamos a senha contra ele assim mesmo. Sem
 * isso, a resposta para e-mail inexistente voltaria muito mais rápido que a de
 * senha errada, e esse tempo diria a um atacante quais e-mails estão
 * cadastrados no clube.
 */
let hashFalso: Promise<string> | undefined
function obterHashFalso(): Promise<string> {
  hashFalso ??= gerarHashDeSenha(randomBytes(32).toString('hex'))
  return hashFalso
}

/**
 * Só aceita caminho interno. Sem isso, `?destino=https://sitedoatacante` faria
 * o nosso login jogar o usuário autenticado em outro domínio.
 */
function destinoSeguro(destino: string | undefined, padrao: string): string {
  if (!destino) return padrao
  if (!destino.startsWith('/') || destino.startsWith('//')) return padrao
  return destino
}

export default defineEventHandler(async (event) => {
  const corpo = await readBody(event)
  const dados = esquema.safeParse(corpo)

  if (!dados.success) {
    return sendRedirect(event, '/entrar?erro=dados', 303)
  }

  const { email, senha, destino } = dados.data
  const chave = `${email}|${getRequestIP(event, { xForwardedFor: true }) ?? 'sem-ip'}`

  if (estaBloqueado(chave)) {
    return sendRedirect(event, '/entrar?erro=bloqueado', 303)
  }

  const prisma = usePrisma()
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { praticante: { select: { nomeCompleto: true } } },
  })

  const confere = usuario
    ? await senhaConfere(usuario.senhaHash, senha)
    : await senhaConfere(await obterHashFalso(), senha)

  // Mesma mensagem para e-mail inexistente e senha errada: dizer qual dos dois
  // falhou entrega a lista de quem tem cadastro no clube.
  if (!usuario || !confere) {
    registrarFalha(chave)
    return sendRedirect(event, '/entrar?erro=credenciais', 303)
  }

  if (!usuario.ativo) {
    registrarFalha(chave)
    return sendRedirect(event, '/entrar?erro=inativo', 303)
  }

  limparTentativas(chave)

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcessoEm: new Date() },
  })

  await setUserSession(event, {
    user: {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      nome: usuario.praticante?.nomeCompleto ?? usuario.email,
      praticanteId: usuario.praticanteId,
    },
  })

  return sendRedirect(event, destinoSeguro(destino, paginaInicialDoPapel(usuario.papel)), 303)
})
