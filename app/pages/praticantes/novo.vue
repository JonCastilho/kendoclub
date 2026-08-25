<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Novo praticante - KendoClub' })
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold mb-6">
      Novo praticante
    </h1>

    <FormularioPraticante
      acao="/api/praticantes"
      texto-botao="Cadastrar"
    />
  </div>
</template>
