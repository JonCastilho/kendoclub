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

/**
 * Quem está lendo, sem exigir sessão.
 *
 * O newsfeed é a primeira parte do sistema que atende visitante anônimo, então
 * aqui não se barra ninguém: descreve-se quem é, e a decisão do que mostrar
 * fica com `podeVer`, em shared/publicacao.ts.
 */
export async function leitorAtual(event: H3Event) {
  const sessao = await getUserSession(event)
  const usuario = sessao?.user as UsuarioSessao | undefined

  return {
    logado: Boolean(usuario),
    ehDiretoria: usuario?.papel === Papel.DIRETORIA,
    usuario: usuario ?? null,
  }
}

/** Para onde cada papel vai depois de entrar. */
export function paginaInicialDoPapel(papel: Papel): string {
  return papel === Papel.DIRETORIA ? '/painel' : '/minha-area'
}
