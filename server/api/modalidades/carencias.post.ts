import { GRAUS_DE_EXAME, SHOGOS, lerMeses } from '~~/shared/exame'
import { ROTULO_DO_SHOGO, rotuloDoGrau } from '~~/shared/graduacao'

/**
 * Tabela de carência de uma modalidade, gravada inteira.
 *
 * Um campo por exame (`meses_DAN_1`…, `meses_RENSHI`, `meses_KYOSHI`). Campo vazio tira a regra:
 * a tabela nasce vazia e cada clube preenche só o que usa, sem valor padrão
 * inventado que viraria aviso falso.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)
  const corpo = (await readBody(event)) ?? {}
  const voltar = '/modalidades'
  const prisma = usePrisma()

  const modalidade = await prisma.modalidade.findUnique({
    where: { id: texto(corpo.modalidadeId) }, select: { id: true },
  })
  if (!modalidade) return responderErro(event, ['Modalidade não encontrada.'], voltar)

  const regras = [
    ...GRAUS_DE_EXAME.map(grau => ({ grau, shogo: null, rotulo: rotuloDoGrau(grau) })),
    ...SHOGOS.map(shogo => ({ grau: null, shogo, rotulo: ROTULO_DO_SHOGO[shogo] })),
  ].map(r => ({ ...r, meses: lerMeses(texto(corpo[`meses_${r.grau ?? r.shogo}`])) }))

  const invalidas = regras.filter(r => r.meses !== null && (!Number.isInteger(r.meses) || r.meses > 600))
  if (invalidas.length > 0) {
    return responderErro(event, invalidas.map(r =>
      `Carência de ${r.rotulo}: use um número inteiro de meses.`), voltar)
  }

  await prisma.$transaction([
    prisma.carenciaGraduacao.deleteMany({ where: { modalidadeId: modalidade.id } }),
    prisma.carenciaGraduacao.createMany({
      data: regras
        .filter(r => r.meses !== null)
        .map(r => ({ modalidadeId: modalidade.id, grau: r.grau, shogo: r.shogo, mesesMinimos: r.meses! })),
    }),
  ])

  return responderSucesso(event, voltar)
})
