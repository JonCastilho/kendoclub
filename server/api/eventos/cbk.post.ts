import { type PosicaoNaEquipe, problemasDaFicha } from '~~/shared/cbk'

/**
 * Grava o nome no zekken/nafuda e a posição na primeira luta de quem compete.
 *
 * Quem preenche é a diretoria, na tela dos dados da CBK: o formulário manda os
 * campos de cada inscrição na competição (`zekken_<id>` e `posicao_<id>`), e só
 * os campos que vieram são gravados. Vazio apaga.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const prisma = usePrisma()

  const evento = await prisma.evento.findUnique({
    where: { id: texto(corpo.eventoId) },
    select: { id: true },
  })
  if (!evento) return responderErro(event, ['Evento não encontrado.'], '/eventos')

  const voltar = `/eventos/${evento.id}/cbk`
  const campos = Object.keys(corpo)
  const ids = [...new Set(
    campos.filter(c => c.startsWith('zekken_') || c.startsWith('posicao_')).map(c => c.slice(c.indexOf('_') + 1)),
  )]

  const inscricoes = await prisma.inscricaoSubevento.findMany({
    where: { id: { in: ids }, inscricaoEvento: { eventoId: evento.id }, subevento: { tipo: 'COMPETICAO' } },
    select: {
      id: true,
      categoriaEquipeId: true,
      inscricaoEvento: { select: { praticante: { select: { nomeCompleto: true } } } },
    },
  })

  const problemas: string[] = []
  if (inscricoes.length !== ids.length) problemas.push('Há inscrições que não são deste evento.')

  const gravar: Array<{ id: string, dados: { nomeNoZekken?: string | null, posicaoNaEquipe?: PosicaoNaEquipe | null } }> = []

  for (const inscricao of inscricoes) {
    const zekken = `zekken_${inscricao.id}` in corpo ? texto(corpo[`zekken_${inscricao.id}`]) : null
    const posicao = `posicao_${inscricao.id}` in corpo ? texto(corpo[`posicao_${inscricao.id}`]) : null

    problemas.push(...problemasDaFicha({
      nome: inscricao.inscricaoEvento.praticante.nomeCompleto,
      zekken: zekken ?? '',
      posicao: posicao ?? '',
      naEquipe: inscricao.categoriaEquipeId !== null,
    }))

    gravar.push({
      id: inscricao.id,
      dados: {
        ...(zekken !== null && { nomeNoZekken: zekken || null }),
        ...(posicao !== null && { posicaoNaEquipe: (posicao || null) as PosicaoNaEquipe | null }),
      },
    })
  }

  if (problemas.length > 0) return responderErro(event, problemas, voltar)

  await prisma.$transaction(gravar.map(g => prisma.inscricaoSubevento.update({ where: { id: g.id }, data: g.dados })))

  return responderSucesso(event, voltar)
})
