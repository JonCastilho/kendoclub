/**
 * Lembrete diário de mensalidade em atraso.
 *
 * O horário está em `nitro.scheduledTasks`, no nuxt.config.ts. A tarefa não
 * decide nada: chama a mesma função do botão da diretoria, que é segura de
 * repetir. Se o servidor ficar fora do ar no horário, a execução do dia
 * seguinte recupera o que venceu, dentro da janela de cada marco.
 */
export default defineTask({
  meta: {
    name: 'lembretes:mensalidades',
    description: 'Envia o lembrete de mensalidade em atraso (15 e 30 dias).',
  },
  async run() {
    const resultado = await enviarLembretesDeMensalidade()

    console.info(
      `[lembretes] ${resultado.pessoas} e-mail(s) enviado(s) `
      + `(${resultado.mensalidades} mensalidade(s)), `
      + `${resultado.semServidorDeEmail} sem servidor de e-mail, `
      + `${resultado.falhas} falha(s).`,
    )

    return { result: resultado }
  },
})
