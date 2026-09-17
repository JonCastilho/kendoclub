import type { Grau } from '@prisma/client'
import { type SexoCategoria, lerIdade, problemasDaCategoria } from '~~/shared/competicao'

/**
 * Cria ou atualiza uma categoria da competição.
 *
 * Editar categoria com inscritos é permitido: a inscrição guarda a categoria
 * escolhida, e a lista de inscritos avisa quem deixou de caber nela.
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
      categorias: { select: { id: true } },
    },
  })
  if (!subevento) return responderErro(event, ['Competição não encontrada.'], '/eventos')

  const voltar = `/eventos/${subevento.eventoId}`
  if (subevento.tipo !== 'COMPETICAO') {
    return responderErro(event, ['Só competição tem categorias.'], voltar)
  }

  const id = texto(corpo.id)
  if (id && !subevento.categorias.some(c => c.id === id)) {
    return responderErro(event, ['Categoria não encontrada.'], voltar)
  }

  const dados = {
    nome: texto(corpo.nome),
    sexo: texto(corpo.sexo),
    idadeMinima: lerIdade(texto(corpo.idadeMinima)),
    idadeMaxima: lerIdade(texto(corpo.idadeMaxima)),
    grauMinimo: opcional(corpo.grauMinimo),
    grauMaximo: opcional(corpo.grauMaximo),
  }

  const problemas = problemasDaCategoria(dados, subevento.modalidade.kyuInicial)
  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  const colunas = {
    nome: dados.nome,
    sexo: dados.sexo as SexoCategoria,
    idadeMinima: dados.idadeMinima,
    idadeMaxima: dados.idadeMaxima,
    grauMinimo: dados.grauMinimo as Grau | null,
    grauMaximo: dados.grauMaximo as Grau | null,
    isenta: marcado(corpo.isenta),
  }

  try {
    if (id) await prisma.categoriaCompeticao.update({ where: { id }, data: colunas })
    else await prisma.categoriaCompeticao.create({ data: { ...colunas, subeventoId: subevento.id } })
  }
  catch (erro) {
    if ((erro as { code?: string })?.code === 'P2002') {
      return responderErro(event, [`Esta competição já tem a categoria "${dados.nome}".`], voltar)
    }
    throw erro
  }

  return responderSucesso(event, voltar)
})
