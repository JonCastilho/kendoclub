export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)

  if (!usuario.praticanteId) {
    // Conta da diretoria sem praticante vinculado não tem mensalidade própria.
    return { mensalidades: [], chavePix: null, titularPix: null, emAberto: 0 }
  }

  const prisma = usePrisma()

  const [mensalidades, clube] = await Promise.all([
    prisma.mensalidade.findMany({
      where: { praticanteId: usuario.praticanteId },
      include: { linhas: { orderBy: { tipo: 'asc' } } },
      orderBy: { competencia: 'desc' },
      take: 24,
    }),
    prisma.configuracaoClube.findUnique({
      where: { id: 1 },
      select: { chavePix: true, titularPix: true },
    }),
  ])

  const emAberto = mensalidades
    .filter(m => m.situacao === 'ABERTA')
    .reduce((total, m) => total + Number(m.valorTotal), 0)

  return {
    mensalidades,
    chavePix: clube?.chavePix ?? null,
    titularPix: clube?.titularPix ?? null,
    emAberto,
  }
})
