import { createHash, randomBytes } from 'node:crypto'

/** Uma hora. Link de redefinição é para usar agora, não amanhã. */
export const VALIDADE_MS = 60 * 60 * 1000

/**
 * O token vai por e-mail; no banco guardamos só o hash dele.
 *
 * Assim, quem obtiver uma cópia do banco não consegue redefinir a senha de
 * ninguém — do mesmo modo que não guardamos a senha em texto puro. Aqui basta
 * SHA-256: o token tem 256 bits de aleatoriedade, então não há o que adivinhar
 * por força bruta, que é o problema que o scrypt resolve para senha humana.
 */
export function gerarToken(): { token: string, hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashDoToken(token) }
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
