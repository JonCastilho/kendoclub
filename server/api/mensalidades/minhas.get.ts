import { declaracaoPendente } from '~~/shared/declaracao'

export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)

  if (!usuario.praticanteId) {
    // Conta da diretoria sem praticante vinculado não tem mensalidade própria.
    return {
      mensalidades: [],
      chavePix: null,
      titularPix: null,
      emAberto: 0,
      aPagar: 0,
      diaDePagamento: null,
      diaDoClube: null,
    }
  }

  const prisma = usePrisma()

  const [mensalidades, clube, praticante] = await Promise.all([
    prisma.mensalidade.findMany({
      where: { praticanteId: usuario.praticanteId },
      include: {
        linhas: { orderBy: { tipo: 'asc' } },
        declaracoes: { orderBy: { criadoEm: 'desc' } },
      },
      orderBy: { competencia: 'desc' },
      take: 24,
    }),
    prisma.configuracaoClube.findUnique({
      where: { id: 1 },
      select: { chavePix: true, titularPix: true, diaVencimento: true },
    }),
    prisma.praticante.findUnique({
      where: { id: usuario.praticanteId },
      select: { diaDePagamento: true },
    }),
  ])

  const abertas = mensalidades.filter(m => m.situacao === 'ABERTA')
  const soma = (lista: typeof abertas) => lista.reduce((total, m) => total + Number(m.valorTotal), 0)

  return {
    mensalidades,
    chavePix: clube?.chavePix ?? null,
    titularPix: clube?.titularPix ?? null,
    emAberto: soma(abertas),
    // O que ainda falta a pessoa fazer: o aviso na Minha área não insiste com
    // quem já avisou que pagou e espera a conferência da diretoria.
    aPagar: soma(abertas.filter(m => !declaracaoPendente(m.declaracoes))),
    diaDePagamento: praticante?.diaDePagamento ?? null,
    diaDoClube: clube?.diaVencimento ?? 10,
  }
})
