import { problemasParaPublicar } from '~~/shared/evento'

/** Publica ou volta a rascunho. Mesmo desenho das notícias. */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const id = texto(corpo.id)
  const voltar = `/eventos/${id}`
  const prisma = usePrisma()

  const evento = await prisma.evento.findUnique({
    where: { id },
    select: { publicadoEm: true, subeventos: { select: { dias: true } } },
  })
  if (!evento) return responderErro(event, ['Evento não encontrado.'], '/eventos')

  const despublicar = texto(corpo.acao) === 'despublicar'

  if (!despublicar) {
    const problemas = problemasParaPublicar(
      evento.subeventos.map(s => ({ dias: diasComoTexto(s.dias) })))
    if (problemas.length > 0) return responderErro(event, problemas, voltar)
  }

  await prisma.evento.update({
    where: { id },
    data: { publicadoEm: despublicar ? null : (evento.publicadoEm ?? new Date()) },
  })

  return responderSucesso(event, voltar)
})
