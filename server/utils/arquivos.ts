import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { extensaoDoTipo, nomeDeCapaValido, type TipoImagem } from '~~/shared/imagem'

/**
 * As imagens ficam em disco, fora do banco e fora do repositório.
 *
 * Guardar os bytes no Postgres engordaria todo dump e todo backup do clube com
 * conteúdo que não é dado de gestão. Em disco, a pasta é uma pasta: dá para
 * copiar junto do backup do banco. Em troca, quem hospedar precisa lembrar dela
 * — está documentado no README, junto da variável NUXT_UPLOAD_DIR.
 */
export function diretorioDeCapas(): string {
  // O String() é por conta da tipagem do runtimeConfig, que chega aqui como
  // genérica; em execução o valor já é o texto vindo de NUXT_UPLOAD_DIR.
  const configurado = String(useRuntimeConfig().uploadDir ?? '') || './uploads'
  const raiz = isAbsolute(configurado) ? configurado : resolve(process.cwd(), configurado)
  return join(raiz, 'capas')
}

/**
 * Grava a imagem com nome sorteado.
 *
 * O nome do arquivo enviado é descartado de propósito: ele é escrito por quem
 * envia e não serve para nada aqui, já que o endereço público sai da publicação.
 */
export async function guardarCapa(bytes: Uint8Array, tipo: TipoImagem): Promise<string> {
  const nome = `${randomBytes(16).toString('hex')}.${extensaoDoTipo(tipo)}`
  const diretorio = diretorioDeCapas()

  await mkdir(diretorio, { recursive: true })
  await writeFile(join(diretorio, nome), bytes)

  return nome
}

/** Devolve os bytes, ou nulo se o arquivo sumiu do disco. */
export async function lerCapa(nome: string): Promise<Buffer | null> {
  if (!nomeDeCapaValido(nome)) return null

  try {
    return await readFile(join(diretorioDeCapas(), nome))
  }
  catch {
    return null
  }
}

/** Apaga em silêncio: arquivo órfão não atrapalha ninguém, erro na tela sim. */
export async function apagarCapa(nome: string | null): Promise<void> {
  if (!nome || !nomeDeCapaValido(nome)) return

  try {
    await unlink(join(diretorioDeCapas(), nome))
  }
  catch {
    // Já não estava lá, ou o disco não deixou. Nos dois casos o registro no
    // banco já foi limpo, que é o que decide o que a página mostra.
  }
}
