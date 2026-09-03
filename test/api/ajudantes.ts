import { ENDERECO } from './preparar'

export { ENDERECO }

/** Conta de diretoria criada pelo preparo, usada como ator padrão dos testes. */
export const DIRETORIA = { email: 'marcador@banco-de-teste', senha: 'senha do marcador' }

export interface Resposta {
  status: number
  destino: string
  ok: boolean
  problemas: string[]
  corpo: Record<string, unknown>
}

/**
 * Envia um formulário como o navegador envia: urlencoded.
 *
 * Existe em duas formas de propósito. Com `accept: application/json` a resposta
 * vem em JSON, que é o caminho do formulário com JavaScript; sem ele, vem
 * redirecionamento, que é o caminho do envio nativo. Os dois precisam funcionar
 * — foi justamente a diferença entre eles que deixou passar o bug em que todo
 * campo chegava vazio ao servidor.
 */
export async function enviar(
  caminho: string,
  dados: Record<string, string> = {},
  opcoes: { cookie?: string, nativo?: boolean } = {},
): Promise<Resposta> {
  const cabecalhos: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (!opcoes.nativo) cabecalhos.accept = 'application/json'
  if (opcoes.cookie) cabecalhos.cookie = opcoes.cookie

  const resposta = await fetch(`${ENDERECO}${caminho}`, {
    method: 'POST',
    redirect: 'manual',
    headers: cabecalhos,
    body: new URLSearchParams(dados),
  })

  const texto = await resposta.text()
  // Erro de servidor devolve HTML, não JSON — por isso a leitura tolerante.
  let corpo: Record<string, unknown>
  try {
    corpo = texto ? JSON.parse(texto) : {}
  }
  catch {
    corpo = {}
  }

  const destino = resposta.headers.get('location') ?? String(corpo.destino ?? '')

  return {
    status: resposta.status,
    destino,
    ok: corpo.ok === true || (resposta.status >= 300 && resposta.status < 400),
    problemas: (corpo.problemas as string[]) ?? [],
    corpo,
  }
}

export async function ler<T = Record<string, unknown>>(
  caminho: string,
  cookie?: string,
): Promise<{ status: number, dados: T }> {
  const resposta = await fetch(`${ENDERECO}${caminho}`, {
    headers: cookie ? { cookie } : {},
  })

  const texto = await resposta.text()
  let dados: T
  try {
    dados = texto ? JSON.parse(texto) : ({} as T)
  }
  catch {
    dados = {} as T
  }

  return { status: resposta.status, dados }
}

/** Entra e devolve o cookie de sessão para reusar nas chamadas seguintes. */
export async function entrar(email: string, senha: string): Promise<string> {
  const resposta = await fetch(`${ENDERECO}/api/auth/entrar`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, senha }),
  })

  const cookie = resposta.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  if (!cookie) throw new Error(`Não consegui entrar como ${email}.`)
  return cookie
}

export const comoDiretoria = () => entrar(DIRETORIA.email, DIRETORIA.senha)

/** Dados mínimos de um praticante válido, com o que cada teste quiser trocar. */
export function dadosDePraticante(sobrescreve: Record<string, string> = {}) {
  return {
    nomeCompleto: 'Praticante de Teste',
    dataNascimento: '1990-05-10',
    sexo: 'MASCULINO',
    documento: '529.982.247-25',
    tipoDocumento: 'CPF',
    titularDocumento: 'PROPRIO',
    email: 'praticante@teste.local',
    telefone: '11 90000-0000',
    filiacaoInicioEm: '2020-01-01',
    ...sobrescreve,
  }
}

/**
 * CPF válido e distinto a partir de uma semente.
 *
 * Nasceu de um erro: os arquivos de teste compartilham o banco, e usar uma lista
 * fixa fez o segundo arquivo colidir com o primeiro. Cada arquivo usa sua faixa
 * de sementes e ninguém mais tromba.
 */
export function gerarCpf(semente: number): string {
  const base = String(100_000_000 + (semente * 7919) % 800_000_000).padStart(9, '0')
  const digitos = base.split('').map(Number)

  for (const posicao of [9, 10]) {
    let soma = 0
    for (let i = 0; i < posicao; i++) soma += digitos[i]! * (posicao + 1 - i)
    const resto = (soma * 10) % 11
    digitos.push(resto === 10 ? 0 : resto)
  }

  return digitos.join('')
}
