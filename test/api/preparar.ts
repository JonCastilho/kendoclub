import { execFileSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { Client } from 'pg'

/**
 * Prepara o ambiente dos testes de endpoint: banco próprio, migrations,
 * servidor de desenvolvimento e — o mais importante — a prova de que o servidor
 * está mesmo falando com o banco de teste.
 *
 * Essa prova não é zelo excessivo. Ao montar isto, descobri que passar
 * DATABASE_URL pelo ambiente NÃO vence o que está no .env: o servidor seguia
 * usando o banco do clube. Um teste destrutivo teria apagado dados de verdade.
 * O caminho que funciona é `nuxt dev --dotenv .env.test`, e esta verificação
 * existe para garantir que ele continue funcionando.
 */

const PORTA = 3100
export const ENDERECO = `http://localhost:${PORTA}`

const ARQUIVO_ENV = '.env.test'
const MARCADOR = { email: 'marcador@banco-de-teste', senha: 'senha do marcador' }

/**
 * Cria o .env.test a partir do .env, trocando só o nome do banco.
 *
 * Existe para que `npm test` funcione logo depois de clonar o projeto, sem
 * ninguém precisar montar arquivo à mão — e para que esse arquivo aponte sempre
 * para um banco separado, em vez de alguém copiá-lo errado.
 */
function garantirArquivoDeAmbiente() {
  if (existsSync(ARQUIVO_ENV)) return

  if (!existsSync('.env')) {
    throw new Error('Crie o .env antes de rodar os testes (veja o .env.example).')
  }

  const linhas = readFileSync('.env', 'utf8').split('\n').map((linha) => {
    if (!linha.startsWith('DATABASE_URL=')) return linha
    const url = new URL(linha.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, ''))
    url.pathname += '_teste'
    return `DATABASE_URL="${url.toString()}"`
  })

  writeFileSync(ARQUIVO_ENV, linhas.join('\n'))
  console.info(`[testes] ${ARQUIVO_ENV} criado a partir do .env, com banco próprio.`)
}

/** Cria o banco de teste se ele ainda não existir. */
async function garantirBanco(url: string) {
  const administrativo = new URL(url)
  const nome = administrativo.pathname.slice(1)
  administrativo.pathname = '/postgres'

  const cliente = new Client({ connectionString: administrativo.toString() })
  await cliente.connect()

  const existe = await cliente.query('select 1 from pg_database where datname = $1', [nome])
  if (existe.rowCount === 0) {
    await cliente.query(`CREATE DATABASE "${nome}"`)
    console.info(`[testes] banco ${nome} criado.`)
  }

  await cliente.end()
}

function urlDoBancoDeTeste(): string {
  garantirArquivoDeAmbiente()

  const linha = readFileSync(ARQUIVO_ENV, 'utf8')
    .split('\n')
    .find(l => l.startsWith('DATABASE_URL='))

  const url = linha?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') ?? ''

  // Trava de segurança: sem o sufixo, os testes se recusam a rodar. É o que
  // impede alguém de apontar o .env.test para o banco de produção sem perceber.
  if (!/_teste(\?|$)/.test(new URL(url).pathname + (new URL(url).search || ''))
    && !/_teste/.test(new URL(url).pathname)) {
    throw new Error('O banco do .env.test precisa terminar em "_teste". Recusando por segurança.')
  }

  return url
}

async function limparBanco(url: string) {
  const cliente = new Client({ connectionString: url })
  await cliente.connect()

  const { rows } = await cliente.query<{ tablename: string }>(
    `select tablename from pg_tables
     where schemaname = 'public' and tablename <> '_prisma_migrations'`,
  )

  if (rows.length > 0) {
    const tabelas = rows.map(r => `"${r.tablename}"`).join(', ')
    await cliente.query(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE`)
  }

  await cliente.end()
}

async function criarMarcador(url: string) {
  const { gerarHashDeSenha } = await import('../../server/utils/senha')
  const cliente = new Client({ connectionString: url })
  await cliente.connect()
  await cliente.query(
    `insert into "Usuario" (id, email, "senhaHash", papel, ativo, "criadoEm", "atualizadoEm")
     values ($1, $2, $3, 'DIRETORIA', true, now(), now())`,
    ['marcador', MARCADOR.email, await gerarHashDeSenha(MARCADOR.senha)],
  )
  await cliente.end()
}

async function esperarServidor(tentativas = 120) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const resposta = await fetch(`${ENDERECO}/entrar`)
      if (resposta.ok) return
    }
    catch {
      // ainda subindo
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('O servidor de teste não respondeu a tempo.')
}

/** Confirma, pelo próprio servidor, que ele está no banco de teste. */
async function provarIsolamento() {
  const resposta = await fetch(`${ENDERECO}/api/auth/entrar`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: MARCADOR.email, senha: MARCADOR.senha }),
  })

  const destino = resposta.headers.get('location') ?? ''
  if (!destino.includes('/painel')) {
    throw new Error(
      'O servidor de teste NÃO está usando o banco de teste — abortando antes de qualquer escrita. '
      + 'Confira se o comando inclui --dotenv .env.test.',
    )
  }
}

export default async function preparar() {
  const url = urlDoBancoDeTeste()
  await garantirBanco(url)

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
    shell: true,
  })

  await limparBanco(url)
  await criarMarcador(url)

  const servidor = spawn(
    'npx',
    ['nuxt', 'dev', '--dotenv', ARQUIVO_ENV, '--port', String(PORTA)],
    // Fora do Windows, o grupo próprio permite derrubar a árvore de uma vez.
    { stdio: 'ignore', shell: true, detached: process.platform !== 'win32' },
  )

  await esperarServidor()
  await provarIsolamento()

  return async () => {
    // Matar só o processo que criamos não basta: o `nuxt dev` deixa vivos o
    // servidor Nitro e dois esbuild, que continuam segurando a porta e o banco.
    // É preciso derrubar a árvore inteira.
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' })
      }
      else {
        process.kill(-servidor.pid!, 'SIGTERM')
      }
    }
    catch {
      // já morreu por conta própria
    }
    servidor.kill()
  }
}
