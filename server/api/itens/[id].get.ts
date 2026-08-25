import { aluguelAberto } from '~~/shared/aluguel'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const prisma = usePrisma()

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      alugueis: {
        orderBy: { inicioEm: 'desc' },
        include: { praticante: { select: { id: true, nomeCompleto: true } } },
      },
    },
  })

  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item não encontrado.' })
  }

  // Só quem está filiado pode alugar, então a lista de escolha já vem filtrada.
  const candidatos = await prisma.praticante.findMany({
    where: { filiacoes: { some: { fimEm: null } } },
    select: { id: true, nomeCompleto: true },
    orderBy: { nomeCompleto: 'asc' },
  })

  return {
    ...item,
    aluguelAtual: aluguelAberto(item.alugueis),
    candidatos,
  }
})
