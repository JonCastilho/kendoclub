import { ehCompetenciaValida } from '~~/shared/competencia'

/**
 * Envia agora os lembretes que a tarefa diária enviaria. É a mesma função, então
 * clicar duas vezes, ou clicar e a tarefa rodar logo depois, não repete e-mail.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const corpo = (await readBody(event)) ?? {}
  const competencia = texto(corpo.competencia)

  const resultado = await enviarLembretesDeMensalidade()

  // O resumo vai na URL pelo mesmo motivo do da geração: sem ele, a pessoa
  // clica e não vê retorno nenhum.
  const resumo = new URLSearchParams({
    ...(ehCompetenciaValida(competencia) ? { competencia } : {}),
    lembretesPessoas: String(resultado.pessoas),
    lembretesMensalidades: String(resultado.mensalidades),
    lembretesSemServidor: String(resultado.semServidorDeEmail),
    lembretesFalhas: String(resultado.falhas),
  })

  return responderSucesso(event, `/mensalidades?${resumo}`)
})
