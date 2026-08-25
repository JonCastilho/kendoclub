/**
 * Filiação ao clube: períodos com início e fim.
 *
 * Não existe campo de situação. Quem tem período em aberto está filiado — assim
 * não há como o campo e o histórico discordarem, e quem sai e volta mantém o
 * registro do tempo anterior.
 */

export interface PeriodoDeFiliacao {
  inicioEm: Date
  fimEm?: Date | null
}

export function filiacaoAberta<T extends PeriodoDeFiliacao>(filiacoes: T[]): T | null {
  return filiacoes.find(f => !f.fimEm) ?? null
}

export function estaFiliado(filiacoes: PeriodoDeFiliacao[]): boolean {
  return filiacaoAberta(filiacoes) !== null
}

/** Data de entrada mais antiga — o "desde" que a diretoria quer ver na ficha. */
export function primeiraFiliacaoEm(filiacoes: PeriodoDeFiliacao[]): Date | null {
  if (filiacoes.length === 0) return null
  return filiacoes.reduce((maisAntiga, f) =>
    f.inicioEm < maisAntiga ? f.inicioEm : maisAntiga, filiacoes[0]!.inicioEm)
}

/**
 * Soma dos dias efetivamente filiado, ignorando os intervalos em que a pessoa
 * esteve fora. Somar do primeiro início até hoje contaria o tempo de afastamento
 * como tempo de casa.
 */
export function diasDeFiliacao(filiacoes: PeriodoDeFiliacao[], hoje: Date = new Date()): number {
  const DIA_MS = 24 * 60 * 60 * 1000

  return filiacoes.reduce((total, f) => {
    const fim = f.fimEm ?? hoje
    if (fim <= f.inicioEm) return total
    return total + Math.floor((fim.getTime() - f.inicioEm.getTime()) / DIA_MS)
  }, 0)
}

/**
 * Verifica se um período novo colide com os existentes.
 *
 * Faz falta porque a data de filiação é informada à mão e pode ser retroativa:
 * sem esta checagem, um erro de digitação cria duas filiações que se cruzam, e
 * aí "desde quando é do clube" passa a ter duas respostas.
 */
export function periodoConflita(
  novo: PeriodoDeFiliacao,
  existentes: PeriodoDeFiliacao[],
): boolean {
  const inicioNovo = novo.inicioEm.getTime()
  const fimNovo = novo.fimEm ? novo.fimEm.getTime() : Number.POSITIVE_INFINITY

  return existentes.some((f) => {
    const inicio = f.inicioEm.getTime()
    const fim = f.fimEm ? f.fimEm.getTime() : Number.POSITIVE_INFINITY
    return inicioNovo < fim && inicio < fimNovo
  })
}

export function periodoValido(periodo: PeriodoDeFiliacao): boolean {
  return !periodo.fimEm || periodo.fimEm > periodo.inicioEm
}
