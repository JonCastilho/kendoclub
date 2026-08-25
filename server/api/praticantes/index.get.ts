import { estaFiliado } from '~~/shared/filiacao'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const { busca, situacao } = getQuery(event)
  const termo = typeof busca === 'string' ? busca.trim() : ''

  const prisma = usePrisma()
  const praticantes = await prisma.praticante.findMany({
    where: termo
      ? {
          OR: [
            { nomeCompleto: { contains: termo, mode: 'insensitive' } },
            { email: { contains: termo, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: camposDaListagem,
    orderBy: { nomeCompleto: 'asc' },
  })

  // A situação vem do histórico de filiação, não de um campo — por isso o filtro
  // é aplicado aqui, e não no banco.
  const comSituacao = praticantes.map(p => ({
    id: p.id,
    nomeCompleto: p.nomeCompleto,
    email: p.email,
    telefone: p.telefone,
    dataNascimento: p.dataNascimento,
    filiado: estaFiliado(p.filiacoes),
    modalidades: p.modalidades.map(m => m.modalidade.nome),
  }))

  const filtrados = situacao === 'FILIADOS'
    ? comSituacao.filter(p => p.filiado)
    : situacao === 'DESLIGADOS'
      ? comSituacao.filter(p => !p.filiado)
      : comSituacao

  return {
    total: filtrados.length,
    filiados: comSituacao.filter(p => p.filiado).length,
    praticantes: filtrados,
  }
})
