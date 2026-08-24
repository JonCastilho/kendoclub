import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// A partir do Prisma 7, a URL do banco vive aqui — e não no schema.prisma.
// É o que as migrations e o `prisma studio` usam; o client em tempo de execução
// recebe a conexão pelo adapter, em server/utils/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
