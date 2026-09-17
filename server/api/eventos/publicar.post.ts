import { ROTULO_DO_TIPO, problemasParaPublicar } from '~~/shared/evento'

/** Publica ou volta a rascunho. Mesmo desenho das notícias. */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const id = texto(corpo.id)
  const voltar = `/eventos/${id}`
  const prisma = usePrisma()

  const evento = await prisma.evento.findUnique({
    where: { id },
    select: {
      publicadoEm: true,
      subeventos: {
        select: {
          dias: true,
          tipo: true,
          modalidade: { select: { nome: true } },
          valor: true,
          _count: { select: { categorias: true, graduacoes: true, shogos: true } },
        },
      },
    },
  })
  if (!evento) return responderErro(event, ['Evento não encontrado.'], '/eventos')

  const despublicar = texto(corpo.acao) === 'despublicar'

  if (!despublicar) {
    const problemas = problemasParaPublicar(evento.subeventos.map(s => ({
      dias: diasComoTexto(s.dias),
      tipo: s.tipo,
      categorias: s._count.categorias,
      graduacoes: s._count.graduacoes,
      shogos: s._count.shogos,
      valor: s.valor === null ? null : Number(s.valor),
      nome: `${ROTULO_DO_TIPO[s.tipo].toLowerCase()} de ${s.modalidade.nome}`,
    })))
    if (problemas.length > 0) return responderErro(event, problemas, voltar)
  }

  await prisma.evento.update({
    where: { id },
    data: { publicadoEm: despublicar ? null : (evento.publicadoEm ?? new Date()) },
  })

  return responderSucesso(event, voltar)
})
