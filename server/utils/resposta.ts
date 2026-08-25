import type { H3Event } from 'h3'

/**
 * Os formulários funcionam de dois jeitos: com JavaScript, enviam por fetch e
 * mostram o erro sem recarregar (o que preserva o que a pessoa digitou — o
 * cadastro de praticante é longo demais para perder); sem JavaScript, é envio
 * nativo e a resposta precisa ser redirecionamento.
 */
function querJson(event: H3Event): boolean {
  return (getHeader(event, 'accept') ?? '').includes('application/json')
}

export function responderErro(event: H3Event, problemas: string[], voltarPara: string) {
  if (querJson(event)) {
    setResponseStatus(event, 422)
    return { ok: false as const, problemas }
  }

  const query = encodeURIComponent(problemas.join('|'))
  return sendRedirect(event, `${voltarPara}?erros=${query}`, 303)
}

export function responderSucesso(event: H3Event, destino: string) {
  if (querJson(event)) {
    return { ok: true as const, destino }
  }
  return sendRedirect(event, destino, 303)
}
