export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const prisma = usePrisma()

  // A linha única é criada pelo setup; se alguém apagou, devolvemos os padrões
  // em vez de quebrar a tela.
  const clube = await prisma.configuracaoClube.findUnique({ where: { id: 1 } })

  return clube ?? {
    id: 1,
    nomeClube: 'Clube de Kendo',
    logo: null,
    emailContato: null,
    chavePix: null,
    titularPix: null,
    valorMensalidade: 0,
    diaVencimento: 10,
    valorAluguelPadrao: 0,
    corPrimaria: '#1e3a8a',
    fusoHorario: 'America/Sao_Paulo',
  }
})
