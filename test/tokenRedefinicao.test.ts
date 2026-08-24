import { describe, expect, it } from 'vitest'
import { VALIDADE_MS, gerarToken, hashDoToken } from '../server/utils/tokenRedefinicao'

describe('token de redefinição', () => {
  it('gera token novo a cada chamada', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => gerarToken().token))
    expect(tokens.size).toBe(200)
  })

  it('devolve o hash correspondente ao token', () => {
    const { token, hash } = gerarToken()
    expect(hash).toBe(hashDoToken(token))
  })

  it('não guarda o token em texto puro', () => {
    // O que vai para o banco não pode servir de link: quem ler o banco não
    // deve conseguir redefinir a senha de ninguém.
    const { token, hash } = gerarToken()
    expect(hash).not.toContain(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('usa token longo o bastante para não ser adivinhado', () => {
    // 32 bytes em base64url ficam com 43 caracteres.
    expect(gerarToken().token.length).toBeGreaterThanOrEqual(43)
  })

  it('vale por uma hora', () => {
    expect(VALIDADE_MS).toBe(60 * 60 * 1000)
  })
})
