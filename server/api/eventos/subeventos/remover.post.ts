import { diasDoEvento } from '~~/shared/evento'

/**
 * Remove um subevento.
 *
 * Com inscritos ou com obento encomendado em dia que deixaria de existir, a
 * remoção pede confirmação e diz o que vai apagar. Sem isso, um clique errado
 * some com inscrições que a diretoria teria de pedir de novo a cada pessoa.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const subevento = await prisma.subevento.findUnique({
    where: { id },
    select: {
      eventoId: true,
      _count: { select: { inscricoes: true } },
      evento: { select: { diasObento: true, subeventos: { select: { id: true, dias: true } } } },
    },
  })
  if (!subevento) return responderErro(event, ['Subevento não encontrado.'], '/eventos')

  const voltar = `/eventos/${subevento.eventoId}`

  const diasRestantes = diasDoEvento(subevento.evento.subeventos
    .filter(s => s.id !== id)
    .map(s => ({ dias: diasComoTexto(s.dias) })))
  const obentoAtual = diasComoTexto(subevento.evento.diasObento)
  const afetados = await obentosAfetados(
    subevento.eventoId, obentoAtual, obentoAtual.filter(dia => diasRestantes.includes(dia)))

  const avisos: string[] = []
  if (subevento._count.inscricoes > 0) {
    avisos.push(`Este subevento tem ${subevento._count.inscricoes} inscrição(ões), que serão apagadas.`)
  }
  if (afetados.quantidade > 0) avisos.push(avisoDeObentosApagados(afetados))

  if (avisos.length > 0 && !marcado(corpo.confirmar)) {
    return responderErro(event, [...avisos, 'Marque a confirmação para remover.'], voltar)
  }

  await prisma.$transaction(async (tx) => {
    await tx.inscricaoSubevento.deleteMany({ where: { subeventoId: id } })
    await tx.subevento.delete({ where: { id } })
    await recalcularEvento(tx, subevento.eventoId)
  })

  return responderSucesso(event, voltar)
})
