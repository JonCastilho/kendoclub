/**
 * Documento do praticante: CPF ou documento estrangeiro.
 *
 * A conferência dos dígitos verificadores só faz sentido no CPF — daí a
 * validação receber o tipo, em vez de tentar adivinhar pelo formato.
 */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Confere os dois dígitos verificadores do CPF.
 *
 * Isso não prova que o CPF existe ou pertence à pessoa; prova que o número está
 * bem formado. Serve para pegar erro de digitação no cadastro, que é o problema
 * real — número trocado vira praticante duplicado e mensalidade órfã.
 */
export function cpfValido(cpf: string): boolean {
  const digitos = apenasDigitos(cpf)

  if (digitos.length !== 11) return false
  // Sequências como 111.111.111-11 passam no cálculo, mas nenhuma é CPF válido.
  if (/^(\d)\1{10}$/.test(digitos)) return false

  const numeros = digitos.split('').map(Number)

  for (const posicao of [9, 10]) {
    let soma = 0
    for (let i = 0; i < posicao; i++) {
      soma += numeros[i]! * (posicao + 1 - i)
    }
    const resto = (soma * 10) % 11
    const esperado = resto === 10 ? 0 : resto
    if (esperado !== numeros[posicao]) return false
  }

  return true
}

export function formatarCpf(cpf: string): string {
  const d = apenasDigitos(cpf)
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Normaliza para guardar: CPF vira só números, documento estrangeiro fica como
 * foi digitado (sem espaços nas pontas), porque não há formato único.
 */
export function normalizarDocumento(documento: string, tipo: 'CPF' | 'DOCUMENTO_ESTRANGEIRO'): string {
  return tipo === 'CPF' ? apenasDigitos(documento) : documento.trim()
}

/** Lista de problemas. Vazia significa documento aceito. */
export function problemasDoDocumento(
  documento: string,
  tipo: 'CPF' | 'DOCUMENTO_ESTRANGEIRO',
): string[] {
  const valor = normalizarDocumento(documento, tipo)

  if (!valor) return ['Informe o documento.']

  if (tipo === 'CPF') {
    if (valor.length !== 11) return ['O CPF precisa ter 11 dígitos.']
    if (!cpfValido(valor)) return ['CPF inválido. Confira os números digitados.']
  }

  return []
}
