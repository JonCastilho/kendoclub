/**
 * Quem receberia lembrete se ele fosse enviado agora. Não envia nem grava
 * nada: serve para a diretoria ver o que o botão vai fazer antes de clicar.
 */
export default defineEventHandler(async (event) => {
  await exigirDiretoria(event)

  const { hoje, lembretes } = await planoDeLembretes()

  return {
    hoje,
    pessoas: lembretes.length,
    mensalidades: lembretes.reduce((total, l) => total + l.itens.length, 0),
    lembretes,
  }
})
