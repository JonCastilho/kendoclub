/**
 * Freio contra tentativa de senha em série.
 *
 * Guarda em memória, o que basta para o modelo de implantação do projeto: uma
 * instância por clube. Se um dia houver mais de um processo, isto vira um
 * contador em banco ou cache compartilhado — e não antes, porque a alternativa
 * seria montar infraestrutura para um clube com cem praticantes.
 */

const MAXIMO_DE_FALHAS = 5
const JANELA_MS = 15 * 60 * 1000

interface Registro {
  falhas: number
  expiraEm: number
}

const registros = new Map<string, Registro>()

function agora(): number {
  return Date.now()
}

/** Remove registros vencidos para o Map não crescer sem limite. */
function limpar(): void {
  const t = agora()
  for (const [chave, registro] of registros) {
    if (registro.expiraEm <= t) registros.delete(chave)
  }
}

export function estaBloqueado(chave: string): boolean {
  const registro = registros.get(chave)
  if (!registro) return false
  if (registro.expiraEm <= agora()) {
    registros.delete(chave)
    return false
  }
  return registro.falhas >= MAXIMO_DE_FALHAS
}

export function registrarFalha(chave: string): void {
  limpar()
  const registro = registros.get(chave)

  if (!registro || registro.expiraEm <= agora()) {
    registros.set(chave, { falhas: 1, expiraEm: agora() + JANELA_MS })
    return
  }

  registro.falhas += 1
  // A janela reinicia a cada falha: quem insiste espera mais.
  registro.expiraEm = agora() + JANELA_MS
}

export function limparTentativas(chave: string): void {
  registros.delete(chave)
}

/** Só para teste — devolve o estado a zero entre casos. */
export function esquecerTudo(): void {
  registros.clear()
}

export const limites = { MAXIMO_DE_FALHAS, JANELA_MS }
