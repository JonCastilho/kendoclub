<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })

const id = useRoute().params.id as string
const { data: praticante } = await useFetch(`/api/praticantes/${id}`)

useHead({ title: () => `Editar ${praticante.value?.nomeCompleto ?? ''} - KendoClub` })
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold mb-6">
      Editar praticante
    </h1>

    <FormularioPraticante
      v-if="praticante"
      :acao="`/api/praticantes/${id}`"
      :praticante="praticante"
      texto-botao="Salvar alterações"
    />
  </div>
</template>
