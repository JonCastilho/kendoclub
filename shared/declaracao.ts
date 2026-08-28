/**
 * Declaração de pagamento: o praticante avisa que pagou, a diretoria confere.
 *
 * A baixa continua sendo ato da diretoria — se declarar desse baixa, bastaria
 * dizer que pagou. O que isto resolve é a fila: hoje o aviso chega por WhatsApp
 * e o tesoureiro precisa caçar quem falou o quê.
 */

/**
 * Data como Date ou texto ISO.
 *
 * O mesmo registro é lido no servidor, onde é Date, e na tela, onde chegou por
 * JSON e virou texto. Estes ajudantes rodam nos dois lados, então aceitam os
 * dois — e comparam convertendo, em vez de confiar no formato.
 */
type DataOuTexto = Date | string

export interface Declaracao {
  pagoEm: DataOuTexto
  analisadaEm?: DataOuTexto | null
  aceita?: boolean | null
  motivoRecusa?: string | null
}

const emMilissegundos = (data: DataOuTexto): number => new Date(data).getTime()

/** A declaração ainda não conferida, se houver. */
export function declaracaoPendente<T extends Declaracao>(declaracoes: T[]): T | null {
  return declaracoes.find(d => !d.analisadaEm) ?? null
}

/** A recusa mais recente, para o praticante saber por que precisa refazer. */
export function ultimaRecusa<T extends Declaracao>(declaracoes: T[]): T | null {
  const recusadas = declaracoes.filter(d => d.analisadaEm && d.aceita === false)
  if (recusadas.length === 0) return null

  return recusadas.reduce((maisRecente, atual) =>
    emMilissegundos(atual.analisadaEm!) > emMilissegundos(maisRecente.analisadaEm!)
      ? atual
      : maisRecente)
}

export interface CondicoesDaDeclaracao {
  situacaoDaMensalidade: string
  jaTemPendente: boolean
  pagoEm: Date
}

/** Lista de impedimentos. Vazia significa que a declaração pode ser registrada. */
export function problemasParaDeclarar(
  condicoes: CondicoesDaDeclaracao,
  hoje: Date = new Date(),
): string[] {
  const problemas: string[] = []

  if (condicoes.situacaoDaMensalidade === 'PAGA') {
    problemas.push('Esta cobrança já está paga.')
  }
  else if (condicoes.situacaoDaMensalidade !== 'ABERTA') {
    problemas.push('Só cobrança em aberto aceita declaração de pagamento.')
  }

  // Uma pendente por vez: clicar duas vezes não pode encher a fila da diretoria
  // com avisos repetidos da mesma cobrança.
  if (condicoes.jaTemPendente) {
    problemas.push('Já existe um aviso de pagamento aguardando conferência.')
  }

  if (condicoes.pagoEm > hoje) {
    problemas.push('A data do pagamento não pode estar no futuro.')
  }

  return problemas
}
