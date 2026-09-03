<script setup lang="ts">
const { data } = await useFetch('/api/publicacoes')
const { loggedIn } = useUserSession()

useHead({ title: 'KendoClub' })

function data_(valor: string | Date | null | undefined) {
  if (!valor) return ''
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <h1 class="text-3xl font-bold">
      Notícias do clube
    </h1>

    <p
      v-if="!loggedIn"
      class="mt-2 text-sm text-muted"
    >
      Praticantes do clube veem também as publicações internas depois de
      <ULink to="/entrar">
        entrar
      </ULink>.
    </p>

    <div
      v-if="!data?.publicacoes.length"
      class="mt-12 text-center text-muted"
    >
      Ainda não há publicações.
    </div>

    <ul
      v-else
      class="mt-8 flex flex-col gap-8"
    >
      <li
        v-for="publicacao in data.publicacoes"
        :key="publicacao.id"
      >
        <article>
          <img
            v-if="publicacao.imagemCapa"
            :src="publicacao.imagemCapa"
            alt=""
            class="w-full rounded-md mb-3"
          >

          <h2 class="text-xl font-semibold">
            <ULink :to="`/noticias/${publicacao.slug}`">
              {{ publicacao.titulo }}
            </ULink>
          </h2>

          <div class="mt-1 flex items-center gap-2 text-xs text-muted">
            <span>{{ data_(publicacao.publicadaEm) }}</span>
            <UBadge
              v-if="publicacao.visibilidade === 'RESTRITA'"
              color="info"
              variant="subtle"
            >
              interna
            </UBadge>
            <UBadge
              v-if="!publicacao.publicadaEm"
              color="neutral"
              variant="subtle"
            >
              rascunho
            </UBadge>
          </div>

          <p class="mt-2 text-muted">
            {{ publicacao.resumo }}
          </p>
        </article>
      </li>
    </ul>
  </div>
</template>
