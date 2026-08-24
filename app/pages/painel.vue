<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Painel - KendoClub' })

const { data: resumo } = await useFetch('/api/painel/resumo')
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-2xl font-bold">
      Painel da diretoria
    </h1>
    <p class="mt-1 text-muted">
      {{ resumo?.nomeClube }}
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <UCard>
        <div class="text-sm text-muted">
          Praticantes ativos
        </div>
        <div class="text-3xl font-bold">
          {{ resumo?.praticantesAtivos ?? 0 }}
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-muted">
          Contas de acesso ativas
        </div>
        <div class="text-3xl font-bold">
          {{ resumo?.contasAtivas ?? 0 }}
        </div>
      </UCard>
    </div>

    <UAlert
      class="mt-8"
      color="neutral"
      variant="subtle"
      title="Próxima etapa"
      description="O cadastro de praticantes e as mensalidades entram nas etapas 2 e 3."
    />
  </div>
</template>
