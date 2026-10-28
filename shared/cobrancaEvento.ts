import { type InscricaoDetalhada, ROTULO_DO_TIPO, type SubeventoDetalhado } from './evento'

/**
 * O que se cobra de quem se inscreve num evento (etapa 7.4b).
 *
 * A cobrança nasce quando a pessoa gera o Pix: guarda o total e os itens
 * daquele momento. Mudar a inscrição depois não reescreve o que foi gerado —
 * só faz o Pix deixar de bater com a inscrição, e a tela pede um novo.
 */

/** "seminário", "competição (Iaido)", "alojamento", "obento (2)". */
export function itensDaInscricao(
  inscricao: Pick<InscricaoDetalhada, 'subeventoIds' | 'alojamento' | 'obentos'>,
  subeventos: Array<Pick<SubeventoDetalhado, 'id' | 'tipo' | 'modalidade'>>,
): string[] {
  const itens: string[] = []

  for (const subevento of subeventos) {
    if (!inscricao.subeventoIds.includes(subevento.id)) continue

    const rotulo = ROTULO_DO_TIPO[subevento.tipo].toLowerCase()
    const maisDeUmDoTipo = subeventos.filter(s => s.tipo === subevento.tipo).length > 1
    itens.push(maisDeUmDoTipo ? `${rotulo} (${subevento.modalidade.nome})` : rotulo)
  }

  if (inscricao.alojamento) itens.push('alojamento')

  const obentos = Object.values(inscricao.obentos).reduce((soma, quantidade) => soma + quantidade, 0)
  if (obentos > 0) itens.push(`obento (${obentos})`)

  return itens
}

/** O Pix gerado ainda vale: a inscrição tem o mesmo total e os mesmos itens. */
export function cobrancaAtualizada(
  gerada: { valor: number, itens: string[] },
  atual: { total: number, itens: string[] },
): boolean {
  return Math.round(gerada.valor * 100) === Math.round(atual.total * 100)
    && gerada.itens.length === atual.itens.length
    && gerada.itens.every((item, i) => item === atual.itens[i])
}
