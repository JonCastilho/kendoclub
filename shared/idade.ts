/**
 * Idade do praticante. Importa porque menor de idade exige responsável e
 * consentimento dele — e porque o documento pode ser o do responsável.
 */

export const MAIORIDADE = 18

export function calcularIdade(dataNascimento: Date, hoje: Date = new Date()): number {
  let idade = hoje.getFullYear() - dataNascimento.getFullYear()

  const mesesAntes = hoje.getMonth() < dataNascimento.getMonth()
  const mesmoMesDiaAntes = hoje.getMonth() === dataNascimento.getMonth()
    && hoje.getDate() < dataNascimento.getDate()

  // Ainda não fez aniversário este ano.
  if (mesesAntes || mesmoMesDiaAntes) idade -= 1

  return idade
}

export function ehMenorDeIdade(dataNascimento: Date, hoje: Date = new Date()): boolean {
  return calcularIdade(dataNascimento, hoje) < MAIORIDADE
}
