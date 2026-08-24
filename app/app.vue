<script setup lang="ts">
const config = useRuntimeConfig()
const enderecoDoCodigo = String(config.public.sourceUrl)
const { loggedIn, user } = useUserSession()
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col">
      <header class="border-b border-default">
        <nav class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <ULink
            to="/"
            class="font-semibold"
          >
            KendoClub
          </ULink>

          <div
            v-if="loggedIn"
            class="flex items-center gap-3 text-sm"
          >
            <ULink :to="user?.papel === 'DIRETORIA' ? '/painel' : '/minha-area'">
              {{ user?.nome }}
            </ULink>
            <!--
              Sair é POST, não link: uma imagem ou um link em outro site poderia
              disparar um GET e derrubar a sessão de quem apenas passou por lá.
            -->
            <form
              method="post"
              action="/api/auth/sair"
            >
              <button
                type="submit"
                class="text-muted hover:text-default"
              >
                Sair
              </button>
            </form>
          </div>

          <ULink
            v-else
            to="/entrar"
            class="text-sm"
          >
            Entrar
          </ULink>
        </nav>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>

      <footer class="border-t border-default py-6 text-center text-sm text-muted">
        <!-- Link exigido pelo artigo 13 da AGPL-3.0. Ver README. -->
        <ULink
          :to="enderecoDoCodigo"
          target="_blank"
          class="hover:text-default"
        >
          código-fonte
        </ULink>
      </footer>
    </div>
  </UApp>
</template>
