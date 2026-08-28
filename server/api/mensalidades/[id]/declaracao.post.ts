import { declaracaoPendente, problemasParaDeclarar } from '~~/shared/declaracao'

export default defineEventHandler(async (event) => {
  const usuario = await exigirUsuario(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const mensalidade = await prisma.mensalidade.findUnique({
    where: { id },
    include: { declaracoes: true },
  })

  if (!mensalidade) {
    throw createError({ statusCode: 404, statusMessage: 'Cobrança não encontrada.' })
  }

  // Recusar é ato da diretoria: ela é quem confere o extrato.
  if (texto(corpo.acao) === 'recusar') {
    if (usuario.papel !== 'DIRETORIA') {
      throw createError({ statusCode: 403, statusMessage: 'Apenas a diretoria confere pagamentos.' })
    }

    const voltar = `/mensalidades?competencia=${mensalidade.competencia}`
    const pendente = declaracaoPendente(mensalidade.declaracoes)
    const motivo = texto(corpo.motivoRecusa)

    if (!pendente) return responderErro(event, ['Não há aviso de pagamento a conferir.'], voltar)
    // Sem motivo, o praticante recebe um "não" que não explica o que fazer.
    if (!motivo) return responderErro(event, ['Diga por que o pagamento não confere.'], voltar)

    await prisma.declaracaoPagamento.update({
      where: { id: pendente.id },
      data: {
        analisadaEm: new Date(),
        aceita: false,
        motivoRecusa: motivo,
        analisadaPorUsuarioId: usuario.id,
      },
    })

    return responderSucesso(event, voltar)
  }

  // Declarar é do dono da cobrança — nem a diretoria avisa por ele.
  if (!usuario.praticanteId || mensalidade.praticanteId !== usuario.praticanteId) {
    throw createError({ statusCode: 403, statusMessage: 'Esta cobrança não é sua.' })
  }

  const voltar = '/minhas-mensalidades'
  const pagoEm = dataUtc(corpo.pagoEm) ?? new Date()

  const problemas = problemasParaDeclarar({
    situacaoDaMensalidade: mensalidade.situacao,
    jaTemPendente: declaracaoPendente(mensalidade.declaracoes) !== null,
    pagoEm,
  })

  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  try {
    await prisma.declaracaoPagamento.create({
      data: { mensalidadeId: id, pagoEm, observacao: opcional(corpo.observacao) },
    })
  }
  catch (erro) {
    // Rede de segurança do banco, para dois envios simultâneos.
    if (JSON.stringify((erro as { meta?: unknown })?.meta ?? '')
      .includes('Declaracao_pendente_unica_por_mensalidade')) {
      return responderErro(event, ['Já existe um aviso aguardando conferência.'], voltar)
    }
    throw erro
  }

  return responderSucesso(event, voltar)
})
