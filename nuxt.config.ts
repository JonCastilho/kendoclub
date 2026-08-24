// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',

  // O projeto roda em Nuxt 3 porque o Node 20 não alcança o Nuxt 4 (PLANO.md §7).
  // Esta flag faz o Nuxt 3 se comportar como o 4 — mesma estrutura de pastas e
  // mesmos padrões — para que a migração futura seja só trocar a versão.
  future: { compatibilityVersion: 4 },

  devtools: { enabled: true },

  modules: ['@nuxt/ui', 'nuxt-auth-utils'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Somente no servidor.
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    uploadDir: './uploads',

    // Exposto ao navegador.
    public: {
      appUrl: 'http://localhost:3000',
      // Link do rodapé exigido pelo artigo 13 da AGPL-3.0.
      sourceUrl: 'https://github.com/JonCastilho/kendoclub',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
