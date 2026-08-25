import { estaFiliado } from '~~/shared/filiacao'
import { problemasParaAlugar } from '~~/shared/aluguel'

interface DadosDoAluguel {
  praticanteId: string
  itemId?: string | null
  descricao?: string | null
  valorMensal: number
  inicioEm: Date
  observacao?: string | null
}

/**
 * Registra um aluguel, com ou sem item vinculado.
 *
 * Fica aqui, e não no endpoint, porque o mesmo registro nasce de dois lugares: a
 * página do item (clube que controla patrimônio) e a ficha do praticante (clube
 * que só quer a taxa na mensalidade). Duas telas, uma regra.
 */
export async function criarAluguel(dados: DadosDoAluguel): Promise<string[]> {
  const prisma = usePrisma()

  const praticante = await prisma.praticante.findUnique({
    where: { id: dados.praticanteId },
    include: { filiacoes: { select: { inicioEm: true, fimEm: true } } },
  })

  if (!praticante) return ['Praticante não encontrado.']

  // A consulta já traz só os aluguéis em aberto, então a contagem responde se
  // o item está com alguém.
  const item = dados.itemId
    ? await prisma.item.findUnique({
        where: { id: dados.itemId },
        include: { alugueis: { where: { fimEm: null }, select: { id: true } } },
      })
    : null

  if (dados.itemId && !item) return ['Item não encontrado.']

  const problemas = problemasParaAlugar({
    item: item ? { situacao: item.situacao, jaAlugado: item.alugueis.length > 0 } : null,
    temDescricao: Boolean(dados.descricao?.trim()),
    praticanteFiliado: estaFiliado(praticante.filiacoes),
    inicioEm: dados.inicioEm,
  })

  if (problemas.length > 0) return problemas

  try {
    await prisma.aluguel.create({
      data: {
        praticanteId: dados.praticanteId,
        itemId: dados.itemId || null,
        descricao: dados.descricao?.trim() || null,
        // O valor é copiado agora: reajustar o item ou a configuração depois não
        // pode reescrever o que já foi combinado com quem está com o equipamento.
        valorMensal: dados.valorMensal,
        inicioEm: dados.inicioEm,
        observacao: dados.observacao || null,
      },
    })
    return []
  }
  catch (erro) {
    // Rede de segurança do banco, para dois envios simultâneos que passem juntos
    // pela verificação acima.
    if (JSON.stringify((erro as { meta?: unknown })?.meta ?? '')
      .includes('Aluguel_aberto_unico_por_item')) {
      return ['Este item já está com outro praticante.']
    }
    throw erro
  }
}

/** Valor sugerido: o do item, quando há; senão o padrão do clube. */
export async function valorSugerido(itemId?: string | null): Promise<number> {
  const prisma = usePrisma()

  if (itemId) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { valorMensalAluguel: true },
    })
    if (item) return Number(item.valorMensalAluguel)
  }

  const clube = await prisma.configuracaoClube.findUnique({
    where: { id: 1 },
    select: { valorAluguelPadrao: true },
  })

  return Number(clube?.valorAluguelPadrao ?? 0)
}
