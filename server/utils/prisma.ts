import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// No Prisma 7 a conexão vem de um adapter, não mais da URL declarada no schema.
// Um único client por processo: em desenvolvimento o Nuxt recarrega o servidor a
// cada alteração, e criar um client por recarga esgota as conexões do Postgres.
let cliente: PrismaClient | undefined

export function usePrisma(): PrismaClient {
  if (!cliente) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada. Copie .env.example para .env.')
    }
    cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  }
  return cliente
}
