import { problemasDaAcao, problemasDaRecusa } from '~~/shared/cobrancaEvento'

/**
 * A diretoria confere o pagamento: aceita ou recusa o comprovante, dá baixa
 * num pagamento feito fora do sistema, ou estorna uma baixa errada.
 *
 * A baixa é sempre ato da diretoria, com registro de quem fez e quando.
 * Aceitar e recusar apagam o comprovante: o que fica é a decisão. Estorno não
 * apaga, carimba — cobrança paga não some em silêncio.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const cobranca = await prisma.cobrancaEvento.findUnique({
    where: { id: texto(corpo.cobrancaId) },
    select: {
      id: true,
      comprovante: true,
      observacao: true,
      inscricaoEvento: { select: { eventoId: true, praticanteId: true } },
    },
  })
  if (!cobranca) return responderErro(event, ['Cobrança não encontrada.'], '/eventos')

  const { eventoId, praticanteId } = cobranca.inscricaoEvento
  const voltar = `/eventos/${eventoId}/pagamentos`

  const conferida = await cobrancaConferida(eventoId, praticanteId)
  if (!conferida?.situacao) return responderErro(event, ['Cobrança não encontrada.'], voltar)

  const acao = texto(corpo.acao)
  const motivo = texto(corpo.motivoRecusa)
  const problemas = [
    ...problemasDaAcao(acao, conferida.situacao, conferida.atualizada),
    ...(acao === 'recusar' ? problemasDaRecusa(motivo) : []),
  ]
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const agora = new Date()
  const quando = agora.toLocaleString('pt-BR')
  const acrescenta = (carimbo: string) => [cobranca.observacao, carimbo].filter(Boolean).join(' ')

  const decisao = { analisadaEm: agora, analisadaPorUsuarioId: usuario.id }
  const dados = {
    aceitar: { ...decisao, aceita: true, motivoRecusa: null, comprovante: null },
    recusar: { ...decisao, aceita: false, motivoRecusa: motivo, comprovante: null },
    baixar: {
      ...decisao,
      aceita: true,
      motivoRecusa: null,
      observacao: acrescenta(`Baixa direta, sem comprovante, por ${usuario.email} em ${quando}.`),
    },
    estornar: {
      aceita: null,
      analisadaEm: null,
      analisadaPorUsuarioId: null,
      declaradaEm: null,
      motivoRecusa: null,
      observacao: acrescenta(`Baixa estornada por ${usuario.email} em ${quando}.`),
    },
  }[acao as 'aceitar' | 'recusar' | 'baixar' | 'estornar']

  await prisma.cobrancaEvento.update({ where: { id: cobranca.id }, data: dados })

  // O arquivo só cai depois de a decisão estar gravada: se algo falhar no meio,
  // o comprovante continua lá para uma nova tentativa.
  if (acao === 'aceitar' || acao === 'recusar') await apagarComprovante(cobranca.comprovante)

  return responderSucesso(event, voltar)
})
