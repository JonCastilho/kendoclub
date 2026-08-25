/**
 * Primeira execução: cria a configuração do clube e a conta inicial da
 * diretoria.
 *
 *   npm run setup -- --email diretoria@seuclube.org
 *
 * A senha é sorteada e mostrada uma única vez. Nenhuma senha padrão vai no
 * código: se fosse, todo clube que instalasse o sistema nasceria com a mesma
 * credencial — pública, já que o código é aberto.
 *
 * Roda fora do servidor Nuxt (via jiti), por isso importa o módulo de senha
 * diretamente e monta o próprio cliente Prisma.
 */
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { gerarHashDeSenha, gerarSenhaAleatoria } from '../server/utils/senha'

function lerArgumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`
  const argumentos = process.argv.slice(2)

  const comIgual = argumentos.find(a => a.startsWith(prefixo))
  if (comIgual) return comIgual.slice(prefixo.length)

  const indice = argumentos.indexOf(`--${nome}`)
  return indice >= 0 ? argumentos[indice + 1] : undefined
}

function encerrarCom(mensagem: string): never {
  console.error(`\n  ${mensagem}\n`)
  process.exit(1)
}

async function principal(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    encerrarCom('DATABASE_URL não configurada. Copie .env.example para .env.')
  }

  const email = lerArgumento('email')?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    encerrarCom('Informe o e-mail: npm run setup -- --email diretoria@seuclube.org')
  }

  const nomeClube = lerArgumento('clube')?.trim()
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

  try {
    const jaExiste = await prisma.usuario.count({ where: { papel: 'DIRETORIA' } })
    if (jaExiste > 0) {
      encerrarCom(
        'Já existe conta de diretoria neste banco. Para recuperar o acesso, use\n'
        + '  "Esqueci minha senha" na tela de login.',
      )
    }

    const emailEmUso = await prisma.usuario.findUnique({ where: { email } })
    if (emailEmUso) encerrarCom(`Já existe uma conta com o e-mail ${email}.`)

    const senha = gerarSenhaAleatoria()

    await prisma.$transaction([
      prisma.configuracaoClube.upsert({
        where: { id: 1 },
        update: nomeClube ? { nomeClube } : {},
        create: { id: 1, ...(nomeClube ? { nomeClube } : {}) },
      }),
      prisma.usuario.create({
        data: { email, senhaHash: await gerarHashDeSenha(senha), papel: 'DIRETORIA' },
      }),
      // Modalidades de partida. Kendo costuma começar no 6º kyu e iaido no 5º;
      // qualquer clube ajusta, renomeia ou desativa na tela de modalidades.
      prisma.modalidade.createMany({
        data: [
          { nome: 'Kendo', kyuInicial: 6 },
          { nome: 'Iaido', kyuInicial: 5 },
        ],
        skipDuplicates: true,
      }),
    ])

    console.log([
      '',
      '  Conta da diretoria criada.',
      '',
      `    e-mail: ${email}`,
      `    senha:  ${senha}`,
      '',
      '  Esta senha não será mostrada de novo. Guarde-a agora e troque-a no',
      '  primeiro acesso, em "Esqueci minha senha".',
      '',
    ].join('\n'))
  } finally {
    await prisma.$disconnect()
  }
}

principal().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
