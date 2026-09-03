<script setup lang="ts">
import type { PublicacaoDetalhada } from '~~/shared/publicacao'

const slug = useRoute().params.slug as string

// Sem `podeVer` do lado do cliente: quem decide é o servidor, que devolve 404
// tanto para o que não existe quanto para o que este leitor não pode ver.
const { data: publicacao, error } = await useFetch<PublicacaoDetalhada>(
  `/api/publicacoes/${slug}`)

// Sem isto a página responderia 200 com o conteúdo vazio: nada vaza, mas um
// buscador indexaria um "não encontrado" como página válida.
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Publicação não encontrada.',
    fatal: true,
  })
}

useHead({ title: () => `${publicacao.value?.titulo ?? 'Notícia'} - KendoClub` })

function data_(valor: string | Date | null | undefined) {
  if (!valor) return 'rascunho'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
</script>

<template>
  <!--
    eslint-disable vue/no-v-html — o HTML vem do servidor, gerado de markdown
    com a opção "html" desligada. Marcação escrita dentro do texto é escapada,
    não interpretada, então não há caminho para script vindo do conteúdo.
  -->
  <article
    v-if="publicacao"
    class="max-w-2xl mx-auto px-4 py-10"
  >
    <img
      v-if="publicacao.imagemCapa"
      :src="publicacao.imagemCapa"
      :alt="''"
      class="w-full rounded-md mb-4"
    >

    <h1 class="text-3xl font-bold">
      {{ publicacao.titulo }}
    </h1>

    <div class="mt-2 flex items-center gap-2 text-sm text-muted">
      <span>{{ data_(publicacao.publicadaEm) }}</span>
      <UBadge
        v-if="publicacao.visibilidade === 'RESTRITA'"
        color="info"
        variant="subtle"
      >
        interna
      </UBadge>
    </div>

    <div
      class="mt-6 flex flex-col gap-4 leading-relaxed"
      v-html="publicacao.html"
    />

    <div class="mt-10 flex gap-4 text-sm">
      <ULink to="/">
        Voltar às notícias
      </ULink>
      <ULink
        v-if="publicacao.podeEditar"
        :to="`/publicacoes/${publicacao.id}`"
      >
        Editar
      </ULink>
    </div>
  </article>
</template>
