/**
 * Política de senha.
 *
 * Segue a recomendação do NIST SP 800-63B: comprimento mínimo generoso e
 * bloqueio de senhas óbvias, em vez de exigir mistura de maiúsculas, números e
 * símbolos. Regra de composição empurra as pessoas para "Senha@123" — atende à
 * exigência e não resiste a nada.
 */

export const COMPRIMENTO_MINIMO = 10
export const COMPRIMENTO_MAXIMO = 200

/**
 * Senhas que apareceriam nas primeiras tentativas de qualquer ataque de
 * dicionário em português. Lista curta de propósito: o valor está em barrar o
 * óbvio, não em manter um catálogo.
 */
const SENHAS_OBVIAS = new Set([
  '1234567890',
  '12345678901',
  '123456789012',
  'senha123456',
  'kendoclube1',
  'kendokendo',
  'qwertyuiop',
  'abcdefghij',
  'primeiro123',
])

/** Lista de problemas encontrados. Vazia significa senha aceita. */
export function problemasDaSenha(senha: string): string[] {
  const problemas: string[] = []

  if (senha.length < COMPRIMENTO_MINIMO) {
    problemas.push(`A senha precisa ter pelo menos ${COMPRIMENTO_MINIMO} caracteres.`)
  }
  if (senha.length > COMPRIMENTO_MAXIMO) {
    problemas.push(`A senha não pode passar de ${COMPRIMENTO_MAXIMO} caracteres.`)
  }
  if (/^\d+$/.test(senha)) {
    problemas.push('A senha não pode ser só números.')
  }
  if (/^(.)\1+$/.test(senha)) {
    problemas.push('A senha não pode ser o mesmo caractere repetido.')
  }
  if (SENHAS_OBVIAS.has(senha.toLowerCase())) {
    problemas.push('Essa senha é previsível demais. Escolha outra.')
  }

  return problemas
}

export function senhaAceita(senha: string): boolean {
  return problemasDaSenha(senha).length === 0
}
