export default defineEventHandler(async (event) => {
  // Barreira real: mesmo que alguém chame esta URL direto, sem passar pela
  // interface, um praticante recebe 403 aqui.
  await exigirDiretoria(event)

  const prisma = usePrisma()
  const [praticantesAtivos, contasAtivas, clube] = await Promise.all([
    // Filiado é quem tem período em aberto — a situação é derivada, não um campo.
    prisma.praticante.count({ where: { filiacoes: { some: { fimEm: null } } } }),
    prisma.usuario.count({ where: { ativo: true } }),
    prisma.configuracaoClube.findUnique({ where: { id: 1 }, select: { nomeClube: true } }),
  ])

  return {
    nomeClube: clube?.nomeClube ?? 'Clube de Kendo',
    praticantesAtivos,
    contasAtivas,
  }
})
