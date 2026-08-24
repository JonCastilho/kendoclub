import { describe, expect, it } from 'vitest'
import { gerarHashDeSenha, gerarSenhaAleatoria, senhaConfere } from '../server/utils/senha'
import { COMPRIMENTO_MINIMO, problemasDaSenha, senhaAceita } from '../shared/senha'

describe('política de senha', () => {
  it('aceita uma frase comum de tamanho razoável', () => {
    expect(problemasDaSenha('kendo no sabado de manha')).toEqual([])
    expect(senhaAceita('bogu novo chegou')).toBe(true)
  })

  it('recusa senha curta', () => {
    expect(senhaAceita('a'.repeat(COMPRIMENTO_MINIMO - 1))).toBe(false)
  })

  it('recusa senha só de números', () => {
    expect(senhaAceita('9081726354')).toBe(false)
  })

  it('recusa caractere repetido', () => {
    expect(senhaAceita('aaaaaaaaaaaa')).toBe(false)
  })

  it('recusa senha previsível, ignorando maiúsculas', () => {
    expect(senhaAceita('QwertyUIOP')).toBe(false)
  })

  it('não exige mistura de símbolos e maiúsculas', () => {
    // Regra de composição empurra para "Senha@123"; o critério aqui é tamanho.
    expect(senhaAceita('conversa no dojo')).toBe(true)
  })
})

describe('hash de senha', () => {
  it('confere a senha correta', async () => {
    const hash = await gerarHashDeSenha('kendo no sabado')
    expect(await senhaConfere(hash, 'kendo no sabado')).toBe(true)
  })

  it('recusa a senha errada', async () => {
    const hash = await gerarHashDeSenha('kendo no sabado')
    expect(await senhaConfere(hash, 'kendo no domingo')).toBe(false)
  })

  it('gera hashes diferentes para a mesma senha', async () => {
    // Sal por senha: dois praticantes com a mesma senha não podem produzir o
    // mesmo hash, senão vazar um vaza o outro.
    const a = await gerarHashDeSenha('mesma senha aqui')
    const b = await gerarHashDeSenha('mesma senha aqui')
    expect(a).not.toBe(b)
  })

  it('guarda os parâmetros dentro do hash', async () => {
    const hash = await gerarHashDeSenha('kendo no sabado')
    expect(hash.split('$').slice(0, 4)).toEqual(['scrypt', '16384', '8', '1'])
  })

  it('não quebra com hash malformado', async () => {
    expect(await senhaConfere('', 'x')).toBe(false)
    expect(await senhaConfere('nada disso', 'x')).toBe(false)
    expect(await senhaConfere('scrypt$16384$8$1$soUmaParte', 'x')).toBe(false)
  })

  it('trata acento igual independentemente da forma de digitação', async () => {
    // 'á' pode chegar como um caractere ou como 'a' + acento combinante; sem
    // normalizar, a mesma senha digitada em teclados diferentes não entraria.
    const composto = 'senha com á aqui'
    const decomposto = composto.normalize('NFD')
    expect(composto).not.toBe(decomposto)
    expect(await senhaConfere(await gerarHashDeSenha(composto), decomposto)).toBe(true)
  })
})

describe('gerarSenhaAleatoria', () => {
  it('respeita o tamanho pedido', () => {
    expect(gerarSenhaAleatoria(16)).toHaveLength(16)
    expect(gerarSenhaAleatoria(24)).toHaveLength(24)
  })

  it('evita caracteres que se confundem quando ditados', () => {
    const amostra = Array.from({ length: 50 }, () => gerarSenhaAleatoria(32)).join('')
    expect(amostra).not.toMatch(/[0O1lI]/)
  })

  it('não repete', () => {
    const geradas = new Set(Array.from({ length: 200 }, () => gerarSenhaAleatoria()))
    expect(geradas.size).toBe(200)
  })

  it('passa na política de senha', () => {
    expect(senhaAceita(gerarSenhaAleatoria())).toBe(true)
  })
})
