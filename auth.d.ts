import type { Papel } from '@prisma/client'

/**
 * Formato do usuário guardado na sessão (nuxt-auth-utils).
 *
 * Sem esta declaração, `user.papel` seria erro de tipo nas páginas e no
 * middleware — e, pior, um `user.papelo` escrito errado passaria calado.
 */
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    papel: Papel
    nome: string
    praticanteId: string | null
  }
}

export {}
