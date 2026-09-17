import { diasDoEvento, ehDiaValido, problemasDoEvento } from '~~/shared/evento'
import { gerarSlug } from '~~/shared/publicacao'

/**
 * Cria ou atualiza o evento. Subeventos têm rota própria, e publicar também.
 *
 * Os dias de obento chegam como `obento_AAAA-MM-DD` marcados: um campo por dia
 * evita ambiguidade na leitura de caixas de seleção repetidas.
 */
export default defineEventHandler(async (event) => {
  const usuario = await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const id = texto(corpo.id)
  const voltar = id ? `/eventos/${id}` : '/eventos'

  const atual = id
    ? await prisma.evento.findUnique({
        where: { id },
        select: { id: true, diasObento: true, subeventos: { select: { dias: true } } },
      })
    : null
  if (id && !atual) return responderErro(event, ['Evento não encontrado.'], '/eventos')

  const dias = diasDoEvento((atual?.subeventos ?? []).map(s => ({ dias: diasComoTexto(s.dias) })))

  const diasObento = Object.keys(corpo)
    .filter(campo => campo.startsWith('obento_') && marcado(corpo[campo]))
    .map(campo => campo.slice('obento_'.length))
    .filter(ehDiaValido)
    .sort()

  const dados = {
    titulo: texto(corpo.titulo),
    descricao: texto(corpo.descricao),
    prazoInscricao: texto(corpo.prazoInscricao),
    ofereceAlojamento: marcado(corpo.ofereceAlojamento),
    valorAlojamento: valorOpcional(corpo.valorAlojamento),
    enderecoAlojamento: opcional(corpo.enderecoAlojamento),
    valorObento: valorOpcional(corpo.valorObento),
    diasObento,
  }

  const problemas = problemasDoEvento(dados, dias)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const visibilidade = texto(corpo.visibilidade) === 'RESTRITA'
    ? ('RESTRITA' as const)
    : ('PUBLICA' as const)

  const colunas = {
    titulo: dados.titulo,
    descricao: dados.descricao,
    visibilidade,
    prazoInscricao: diaComoData(dados.prazoInscricao),
    ofereceAlojamento: dados.ofereceAlojamento,
    // Quem deixa de oferecer não carrega valor e endereço antigos.
    valorAlojamento: dados.ofereceAlojamento ? dados.valorAlojamento : null,
    enderecoAlojamento: dados.ofereceAlojamento ? dados.enderecoAlojamento : null,
    valorObento: dados.valorObento,
  }

  if (!atual) {
    const criado = await prisma.evento.create({
      data: {
        ...colunas,
        slug: await slugDeEventoDisponivel(gerarSlug(dados.titulo)),
        criadoPorUsuarioId: usuario.id,
      },
      select: { id: true },
    })
    return responderSucesso(event, `/eventos/${criado.id}`)
  }

  const afetados = await obentosAfetados(atual.id, diasComoTexto(atual.diasObento), diasObento)
  if (afetados.quantidade > 0 && !marcado(corpo.confirmarApagarObentos)) {
    return responderErro(event, [
      avisoDeObentosApagados(afetados), 'Marque a confirmação para seguir.'], voltar)
  }

  await prisma.$transaction(async (tx) => {
    // O endereço não muda com o título, como nas notícias: link já divulgado
    // continua valendo.
    await tx.evento.update({ where: { id: atual.id }, data: colunas })
    await recalcularEvento(tx, atual.id, diasObento)
  })

  return responderSucesso(event, voltar)
})
