import { type ScryptOptions, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * scrypt em forma de promessa. Feito à mão porque o promisify do Node perde a
 * sobrecarga que recebe as opções de custo — justamente o que precisamos passar.
 */
function derivar(
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, opcoes, (erro, chave) => {
      if (erro) rejeitar(erro)
      else resolver(chave)
    })
  })
}

/**
 * Guarda de senha com scrypt, do módulo crypto do próprio Node.
 *
 * Por que não o hashPassword do nuxt-auth-utils: ele só existe dentro do
 * servidor Nitro, e o script de criação do primeiro administrador roda fora
 * dele. Duas formas de gerar hash de senha no mesmo projeto seria pior do que
 * este arquivo.
 *
 * Parâmetros: N=16384, r=8, p=1 — o custo recomendado pelo OWASP para scrypt,
 * exigindo cerca de 16 MB de memória por verificação. Mudar N invalida os hashes
 * existentes; por isso ele viaja dentro do hash, e não numa constante solta.
 */
const N = 16384
const R = 8
const P = 1
const BYTES_DERIVADOS = 64
const BYTES_SAL = 16

export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(BYTES_SAL)
  const derivado = await derivar(senha.normalize('NFKC'), sal, BYTES_DERIVADOS, {
    N, r: R, p: P, maxmem: 256 * N * R,
  })

  return ['scrypt', N, R, P, sal.toString('base64'), derivado.toString('base64')].join('$')
}

export async function senhaConfere(hashArmazenado: string, senha: string): Promise<boolean> {
  const partes = hashArmazenado.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false

  const [, n, r, p, salB64, derivadoB64] = partes
  const sal = Buffer.from(salB64!, 'base64')
  const esperado = Buffer.from(derivadoB64!, 'base64')

  const calculado = await derivar(senha.normalize('NFKC'), sal, esperado.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * Number(n) * Number(r),
  })

  // Comparação em tempo constante: comparar com === vazaria, pelo tempo de
  // resposta, quantos bytes iniciais o atacante acertou.
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado)
}

/**
 * Senha aleatória legível para o primeiro acesso. Usa o alfabeto sem os
 * caracteres que se confundem quando alguém dita ou copia à mão (0/O, 1/l/I).
 */
export function gerarSenhaAleatoria(tamanho = 16): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

  // Amostragem por rejeição: `byte % 56` faria os primeiros caracteres do
  // alfabeto saírem com mais frequência que os últimos, porque 256 não é
  // múltiplo de 56. Descartar os bytes acima do maior múltiplo elimina o viés.
  const limite = Math.floor(256 / alfabeto.length) * alfabeto.length
  let senha = ''

  while (senha.length < tamanho) {
    for (const byte of randomBytes(tamanho)) {
      if (byte >= limite) continue
      senha += alfabeto[byte % alfabeto.length]
      if (senha.length === tamanho) break
    }
  }

  return senha
}
