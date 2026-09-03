import { defineConfig } from 'vitest/config'

/**
 * Dois conjuntos com propósitos diferentes:
 *
 * - `unidade` roda em milissegundos e cobre as regras puras. É o que se roda a
 *   toda hora enquanto se escreve código.
 * - `api` sobe a aplicação de verdade contra um banco próprio e exercita os
 *   endpoints. É lento, mas é a fronteira onde os bugs de fato apareceram:
 *   formulário chegando vazio, campo assumido pelo servidor, permissão.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidade',
          include: ['test/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['test/api/*.spec.ts'],
          environment: 'node',
          globalSetup: ['test/api/preparar.ts'],
          // Um banco só, compartilhado: arquivos em paralelo disputariam os
          // mesmos registros.
          fileParallelism: false,
          testTimeout: 30_000,
          // O preparo sobe o servidor antes do primeiro teste.
          hookTimeout: 240_000,
        },
      },
    ],
  },
})
