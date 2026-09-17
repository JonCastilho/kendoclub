import { problemasDoShogoOferecido } from '~~/shared/exame'
import { ROTULO_DO_SHOGO, type Shogo } from '~~/shared/graduacao'

/**
 * Oferece exame de shogo (Renshi ou Kyoshi), ou corrige o valor de um já
 * oferecido. Como nas graduações, o shogo de uma banca gravada não muda.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const subevento = await prisma.subevento.findUnique({
    where: { id: texto(corpo.subeventoId) },
    select: { id: true, tipo: true, eventoId: true, shogos: { select: { id: true, shogo: true } } },
  })
  if (!subevento) return responderErro(event, ['Exame não encontrado.'], '/eventos')

  const voltar = `/eventos/${subevento.eventoId}`
  if (subevento.tipo !== 'EXAME') return responderErro(event, ['Só exame oferece shogo.'], voltar)

  const id = texto(corpo.id)
  const existente = subevento.shogos.find(s => s.id === id)
  if (id && !existente) return responderErro(event, ['Shogo não encontrado.'], voltar)

  const dados = { shogo: existente?.shogo ?? texto(corpo.shogo), valor: valorOpcional(corpo.valor) }

  const problemas = problemasDoShogoOferecido(dados)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  if (existente) {
    await prisma.shogoExame.update({ where: { id: existente.id }, data: { valor: dados.valor! } })
    return responderSucesso(event, voltar)
  }

  const shogo = dados.shogo as Shogo
  if (subevento.shogos.some(s => s.shogo === shogo)) {
    return responderErro(event, [`Este exame já oferece ${ROTULO_DO_SHOGO[shogo]}.`], voltar)
  }

  await prisma.shogoExame.create({ data: { subeventoId: subevento.id, shogo, valor: dados.valor! } })
  return responderSucesso(event, voltar)
})
