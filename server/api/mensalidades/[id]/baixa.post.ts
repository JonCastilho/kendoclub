import { interpretarValor } from '~~/shared/dinheiro'

export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const mensalidade = await prisma.mensalidade.findUnique({ where: { id } })
  if (!mensalidade) {
    throw createError({ statusCode: 404, statusMessage: 'Mensalidade não encontrada.' })
  }

  const voltar = `/mensalidades?competencia=${mensalidade.competencia}`

  if (texto(corpo.acao) === 'estornar') {
    if (mensalidade.situacao !== 'PAGA') {
      return responderErro(event, ['Só é possível estornar cobrança paga.'], voltar)
    }

    // O estorno não apaga o que houve: registra na observação quem estornou e
    // quando. Cobrança paga não some em silêncio — PLANO.md §11.
    const carimbo = `Baixa estornada por ${usuario.email} em ${new Date().toLocaleString('pt-BR')}.`

    await prisma.mensalidade.update({
      where: { id },
      data: {
        situacao: 'ABERTA',
        pagaEm: null,
        valorPago: null,
        formaPagamento: null,
        baixadaPorUsuarioId: null,
        observacao: [mensalidade.observacao, carimbo].filter(Boolean).join(' '),
      },
    })

    return responderSucesso(event, voltar)
  }

  if (mensalidade.situacao === 'PAGA') {
    return responderErro(event, ['Esta cobrança já está paga.'], voltar)
  }
  if (mensalidade.situacao === 'CANCELADA') {
    return responderErro(event, ['Cobrança cancelada não recebe baixa.'], voltar)
  }

  const pagaEm = dataUtc(corpo.pagaEm) ?? new Date()
  if (pagaEm > new Date()) {
    return responderErro(event, ['O pagamento não pode ter data no futuro.'], voltar)
  }

  const valorInformado = texto(corpo.valorPago)
  const valorPago = valorInformado
    ? interpretarValor(valorInformado)
    : Number(mensalidade.valorTotal)

  if (valorPago === null) {
    return responderErro(event, ['Valor pago inválido.'], voltar)
  }

  await prisma.mensalidade.update({
    where: { id },
    data: {
      situacao: 'PAGA',
      pagaEm,
      valorPago,
      formaPagamento: opcional(corpo.formaPagamento) ?? 'Pix',
      observacao: opcional(corpo.observacao) ?? mensalidade.observacao,
      // Quem deu a baixa fica registrado, sempre.
      baixadaPorUsuarioId: usuario.id,
    },
  })

  return responderSucesso(event, voltar)
})
