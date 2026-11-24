<script setup lang="ts">
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'autenticado' })
useHead({ title: 'Minha área - KendoClub' })

const { user } = useUserSession()

// Só mensalidade aparece aqui: é a cobrança que se repete todo mês e que o
// clube cobra por e-mail. Evento e exame mostram a situação na própria página.
const { data: mensalidades } = await useFetch('/api/mensalidades/minhas')
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-12">
    <h1 class="text-2xl font-bold">
      Minha área
    </h1>
    <p class="mt-1 text-muted">
      {{ user?.nome }}
    </p>

    <UAlert
      v-if="mensalidades?.aPagar"
      class="mt-6"
      color="warning"
      variant="subtle"
      :title="`${formatarReais(mensalidades.aPagar)} em mensalidades em aberto`"
    >
      <template #description>
        <ULink
          to="/minhas-mensalidades"
          class="underline"
        >
          Veja o que falta pagar e como pagar
        </ULink>.
      </template>
    </UAlert>

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

    <div class="mt-8 flex flex-wrap gap-3">
      <ULink
        to="/minhas-mensalidades"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Minhas mensalidades
      </ULink>
      <ULink
        to="/agenda"
        class="rounded-md border border-default px-4 py-2"
      >
        Agenda e inscrições
      </ULink>
    </div>
  </div>
</template>
