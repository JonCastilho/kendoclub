import type { H3Event } from 'h3'
import { Papel } from '@prisma/client'

/**
 * O que fica guardado no cookie de sessão. Só o suficiente para desenhar a
 * interface e decidir permissão — nada de dado sensível, porque o cookie viaja
 * em toda requisição.
 */
export interface UsuarioSessao {
  id: string
  email: string
  papel: Papel
  nome: string
  praticanteId: string | null
}

/**
 * Exige alguém autenticado. A verificação vive aqui, no servidor: esconder um
 * botão na interface é conveniência, não controle de acesso.
 */
export async function exigirUsuario(event: H3Event): Promise<UsuarioSessao> {
  const { user } = await requireUserSession(event)
  return user as unknown as UsuarioSessao
}

/** Exige alguém da diretoria. Responde 403 para praticante autenticado. */
export async function exigirDiretoria(event: H3Event): Promise<UsuarioSessao> {
  const usuario = await exigirUsuario(event)

  if (usuario.papel !== Papel.DIRETORIA) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta área é restrita à diretoria.',
    })
  }

  return usuario
}

/** Para onde cada papel vai depois de entrar. */
export function paginaInicialDoPapel(papel: Papel): string {
  return papel === Papel.DIRETORIA ? '/painel' : '/minha-area'
}
