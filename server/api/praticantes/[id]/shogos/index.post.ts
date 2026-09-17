import { problemasDoShogoDoPraticante } from '~~/shared/exame'
import { diaDe, ehDiaValido, hojeNoFuso } from '~~/shared/evento'
import type { Shogo } from '~~/shared/graduacao'

/**
 * Registra um título (shogo) do praticante numa modalidade, ou corrige a data
 * de um já registrado. Renshi pede 5º dan; Kyoshi pede Renshi.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const id = getRouterParam(event, 'id')!
  const corpo = (await readBody(event)) ?? {}
  const voltar = `/praticantes/${id}`
  const prisma = usePrisma()

  const vinculo = await prisma.praticanteModalidade.findFirst({
    where: { praticanteId: id, modalidadeId: texto(corpo.modalidadeId) },
    select: { id: true, grau: true, shogos: { select: { shogo: true, obtidoEm: true } } },
  })
  if (!vinculo) return responderErro(event, ['Este praticante não faz essa modalidade.'], voltar)

  const obtidoEm = texto(corpo.obtidoEm)
  const renshi = vinculo.shogos.find(s => s.shogo === 'RENSHI')
  const problemas = problemasDoShogoDoPraticante({
    shogo: texto(corpo.shogo),
    obtidoEm: ehDiaValido(obtidoEm) ? obtidoEm : null,
    grau: vinculo.grau,
    renshiEm: renshi ? diaDe(renshi.obtidoEm) : null,
    hoje: hojeNoFuso(await fusoDoClube()),
  })
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const shogo = texto(corpo.shogo) as Shogo
  await prisma.shogoPraticante.upsert({
    where: { praticanteModalidadeId_shogo: { praticanteModalidadeId: vinculo.id, shogo } },
    create: { praticanteModalidadeId: vinculo.id, shogo, obtidoEm: dataUtc(obtidoEm)! },
    update: { obtidoEm: dataUtc(obtidoEm)! },
  })

  return responderSucesso(event, voltar)
})
