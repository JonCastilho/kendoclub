export default defineEventHandler(async (event) => {
  await exigirUsuario(event)

  const prisma = usePrisma()

  return prisma.modalidade.findMany({
    orderBy: { nome: 'asc' },
    include: { _count: { select: { praticantes: true } } },
  })
})
