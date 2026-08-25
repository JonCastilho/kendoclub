/**
 * Aluguel de equipamento. Como na filiação, "está alugado" é derivado de existir
 * período em aberto, e não um campo que possa discordar da realidade.
 *
 * O item é opcional de propósito. Nem todo dojo controla patrimônio, e bogu é um
 * conjunto de peças que muitas vezes se aluga separado — quem só precisa somar a
 * taxa na mensalidade registra a descrição ("Kote") e não cadastra item nenhum.
 */

export type SituacaoItem = 'DISPONIVEL' | 'MANUTENCAO' | 'BAIXADO'

export interface PeriodoDeAluguel {
  inicioEm: Date
  fimEm?: Date | null
}

export function aluguelAberto<T extends PeriodoDeAluguel>(alugueis: T[]): T | null {
  return alugueis.find(a => !a.fimEm) ?? null
}

export function itemEstaAlugado(alugueis: PeriodoDeAluguel[]): boolean {
  return aluguelAberto(alugueis) !== null
}

/** O que aparece na tela: a descrição escrita, ou o nome do item vinculado. */
export function descricaoDoAluguel(aluguel: {
  descricao?: string | null
  item?: { nome: string, identificador?: string | null } | null
}): string {
  if (aluguel.item) {
    return aluguel.item.identificador
      ? `${aluguel.item.nome} (${aluguel.item.identificador})`
      : aluguel.item.nome
  }
  return aluguel.descricao?.trim() || 'Equipamento'
}

export interface CondicoesDoAluguel {
  /// Ausente quando o clube não controla patrimônio.
  item?: { situacao: SituacaoItem, jaAlugado: boolean } | null
  temDescricao: boolean
  praticanteFiliado: boolean
  inicioEm: Date
}

/** Lista de impedimentos. Vazia significa que pode alugar. */
export function problemasParaAlugar(
  condicoes: CondicoesDoAluguel,
  hoje: Date = new Date(),
): string[] {
  const problemas: string[] = []

  if (condicoes.item) {
    if (condicoes.item.situacao === 'BAIXADO') {
      problemas.push('Item baixado não pode ser alugado.')
    }
    if (condicoes.item.situacao === 'MANUTENCAO') {
      problemas.push('Item em manutenção não pode ser alugado.')
    }
    if (condicoes.item.jaAlugado) {
      problemas.push('Este item já está com outro praticante.')
    }
  }
  else if (!condicoes.temDescricao) {
    // Sem item e sem descrição, a linha na mensalidade sairia sem dizer do quê.
    problemas.push('Descreva o que está sendo alugado.')
  }

  // Praticante desligado não leva equipamento do clube — e, a partir da etapa 4,
  // o aluguel vira linha de cobrança, o que geraria mensalidade para quem saiu.
  if (!condicoes.praticanteFiliado) {
    problemas.push('Praticante desligado não pode alugar item.')
  }

  if (condicoes.inicioEm > hoje) {
    problemas.push('A retirada não pode ter data no futuro.')
  }

  return problemas
}

export function problemasParaDevolver(
  periodo: { inicioEm: Date, fimEm: Date },
  hoje: Date = new Date(),
): string[] {
  const problemas: string[] = []

  if (periodo.fimEm < periodo.inicioEm) {
    problemas.push('A devolução não pode ser anterior à retirada.')
  }
  if (periodo.fimEm > hoje) {
    problemas.push('A devolução não pode ter data no futuro.')
  }

  return problemas
}
