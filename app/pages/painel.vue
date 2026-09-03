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

    <div class="mt-8 flex gap-3 flex-wrap">
      <ULink
        to="/praticantes"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Praticantes
      </ULink>
      <ULink
        to="/mensalidades"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Mensalidades
      </ULink>
      <ULink
        to="/publicacoes"
        class="rounded-md border border-default px-4 py-2"
      >
        Publicações
      </ULink>
      <ULink
        to="/itens"
        class="rounded-md border border-default px-4 py-2"
      >
        Itens alugáveis
      </ULink>
      <ULink
        to="/modalidades"
        class="rounded-md border border-default px-4 py-2"
      >
        Modalidades
      </ULink>
      <ULink
        to="/configuracoes"
        class="rounded-md border border-default px-4 py-2"
      >
        Configurações
      </ULink>
    </div>

    <UAlert
      class="mt-8"
      color="neutral"
      variant="subtle"
      title="Próximas etapas"
      description="Itens alugáveis e mensalidades entram nas etapas 3 e 4."
    />
  </div>
</template>
