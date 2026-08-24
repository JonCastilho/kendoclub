<script setup lang="ts">
definePageMeta({ middleware: 'autenticado' })
useHead({ title: 'Minha área - KendoClub' })

const { user } = useUserSession()
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-2xl font-bold">
      Minha área
    </h1>
    <p class="mt-1 text-muted">
      {{ user?.nome }}
    </p>

    <UCard class="mt-8">
      <dl class="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt class="text-muted">
            E-mail
          </dt>
          <dd>{{ user?.email }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Perfil de acesso
          </dt>
          <dd>{{ user?.papel === 'DIRETORIA' ? 'Diretoria' : 'Praticante' }}</dd>
        </div>
      </dl>
    </UCard>

    <UAlert
      class="mt-8"
      color="neutral"
      variant="subtle"
      title="Próximas etapas"
      description="Suas mensalidades, o feed do clube e a confirmação de presença em eventos chegam nas etapas 3 a 5."
    />
  </div>
</template>
