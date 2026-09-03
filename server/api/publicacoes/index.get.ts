/**
 * O feed. Único endpoint de leitura que atende visitante anônimo — por isso a
 * filtragem por visibilidade é a linha mais importante deste arquivo.
 */
export default defineEventHandler(async (event) => {
  const leitor = await leitorAtual(event)
  const prisma = usePrisma()

  const publicacoes = await prisma.publicacao.findMany({
    // O banco já devolve só o que o leitor pode ver: rascunho e restrito não
    // saem do Postgres para quem não tem direito, em vez de serem filtrados
    // depois — filtro esquecido na camada de cima vira vazamento.
    where: leitor.ehDiretoria
      ? undefined
      : {
          publicadaEm: { not: null },
          ...(leitor.logado ? {} : { visibilidade: 'PUBLICA' }),
        },
    orderBy: [{ publicadaEm: 'desc' }, { criadoEm: 'desc' }],
    take: 30,
    select: {
      id: true,
      titulo: true,
      slug: true,
      conteudo: true,
      imagemCapa: true,
      visibilidade: true,
      publicadaEm: true,
      criadoEm: true,
    },
  })

  return {
    leitorLogado: leitor.logado,
    publicacoes: publicacoes.map(p => ({
      ...p,
      conteudo: undefined,
      resumo: resumoDoTexto(p.conteudo),
    })),
  }
})
