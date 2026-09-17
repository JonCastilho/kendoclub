import type { Grau } from '@prisma/client'
import { problemasDaGraduacaoOferecida } from '~~/shared/exame'
import { rotuloDaGraduacao } from '~~/shared/graduacao'

/**
 * Oferece uma graduação no exame, ou corrige o valor de uma já oferecida.
 *
 * A graduação de uma linha já gravada não muda: quem está inscrito para 1º dan
 * não pode passar a estar inscrito para outra coisa. Para trocar, remove-se.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const subevento = await prisma.subevento.findUnique({
    where: { id: texto(corpo.subeventoId) },
    select: {
      id: true,
      tipo: true,
      eventoId: true,
      modalidade: { select: { kyuInicial: true } },
      graduacoes: { select: { id: true, grau: true } },
    },
  })
  if (!subevento) return responderErro(event, ['Exame não encontrado.'], '/eventos')

  const voltar = `/eventos/${subevento.eventoId}`
  if (subevento.tipo !== 'EXAME') {
    return responderErro(event, ['Só exame oferece graduações.'], voltar)
  }

  const id = texto(corpo.id)
  const existente = subevento.graduacoes.find(g => g.id === id)
  if (id && !existente) return responderErro(event, ['Graduação não encontrada.'], voltar)

  const dados = {
    grau: existente?.grau ?? texto(corpo.grau),
    valor: valorOpcional(corpo.valor),
  }

  const problemas = problemasDaGraduacaoOferecida(dados, subevento.modalidade.kyuInicial)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  if (existente) {
    await prisma.graduacaoExame.update({ where: { id: existente.id }, data: { valor: dados.valor! } })
    return responderSucesso(event, voltar)
  }

  if (subevento.graduacoes.some(g => g.grau === dados.grau)) {
    return responderErro(event,
      [`Este exame já oferece ${rotuloDaGraduacao(dados.grau as Grau)}.`], voltar)
  }

  await prisma.graduacaoExame.create({
    data: { subeventoId: subevento.id, grau: dados.grau as Grau, valor: dados.valor! },
  })

  return responderSucesso(event, voltar)
})
