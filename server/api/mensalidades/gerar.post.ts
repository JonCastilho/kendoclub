import { ehCompetenciaValida } from '~~/shared/competencia'

export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const competencia = texto(corpo.competencia)

  if (!ehCompetenciaValida(competencia)) {
    return responderErro(event, ['Competência inválida. Use o formato AAAA-MM.'], '/mensalidades')
  }

  const resultado = await gerarMensalidades(competencia)

  // O resumo vai na URL para a tela conseguir dizer o que aconteceu depois do
  // redirecionamento — clicar em "gerar" e não ver retorno nenhum é o tipo de
  // silêncio que faz a pessoa clicar de novo.
  const resumo = new URLSearchParams({
    competencia,
    criadas: String(resultado.criadas),
    isentas: String(resultado.isentas),
    jaExistiam: String(resultado.jaExistiam),
    semCobranca: String(resultado.semCobranca),
  })

  return responderSucesso(event, `/mensalidades?${resumo}`)
})
