import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  esquecerTudo,
  estaBloqueado,
  limites,
  limparTentativas,
  registrarFalha,
} from '../server/utils/limiteTentativas'

describe('limite de tentativas', () => {
  beforeEach(() => {
    esquecerTudo()
    vi.useRealTimers()
  })

  it('deixa passar quem nunca errou', () => {
    expect(estaBloqueado('alguem@clube.org|127.0.0.1')).toBe(false)
  })

  it('bloqueia ao atingir o limite de falhas', () => {
    const chave = 'alguem@clube.org|127.0.0.1'
    for (let i = 0; i < limites.MAXIMO_DE_FALHAS - 1; i++) {
      registrarFalha(chave)
      expect(estaBloqueado(chave)).toBe(false)
    }
    registrarFalha(chave)
    expect(estaBloqueado(chave)).toBe(true)
  })

  it('não contamina outra conta ou outro endereço', () => {
    const chave = 'alguem@clube.org|127.0.0.1'
    for (let i = 0; i < limites.MAXIMO_DE_FALHAS; i++) registrarFalha(chave)

    expect(estaBloqueado(chave)).toBe(true)
    expect(estaBloqueado('outro@clube.org|127.0.0.1')).toBe(false)
    expect(estaBloqueado('alguem@clube.org|10.0.0.9')).toBe(false)
  })

  it('libera depois da janela', () => {
    vi.useFakeTimers()
    const chave = 'alguem@clube.org|127.0.0.1'
    for (let i = 0; i < limites.MAXIMO_DE_FALHAS; i++) registrarFalha(chave)
    expect(estaBloqueado(chave)).toBe(true)

    vi.advanceTimersByTime(limites.JANELA_MS + 1000)
    expect(estaBloqueado(chave)).toBe(false)
  })

  it('estende a janela a cada nova falha', () => {
    vi.useFakeTimers()
    const chave = 'alguem@clube.org|127.0.0.1'
    for (let i = 0; i < limites.MAXIMO_DE_FALHAS; i++) registrarFalha(chave)

    vi.advanceTimersByTime(limites.JANELA_MS - 1000)
    registrarFalha(chave)
    vi.advanceTimersByTime(2000)

    // Sem a extensão, esta espera já teria liberado o acesso.
    expect(estaBloqueado(chave)).toBe(true)
  })

  it('zera o contador quando a senha acerta', () => {
    const chave = 'alguem@clube.org|127.0.0.1'
    for (let i = 0; i < limites.MAXIMO_DE_FALHAS; i++) registrarFalha(chave)
    limparTentativas(chave)
    expect(estaBloqueado(chave)).toBe(false)
  })
})
