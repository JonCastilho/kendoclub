<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Praticantes - KendoClub' })

const rota = useRoute()

const { data } = await useFetch('/api/praticantes', {
  query: computed(() => ({ busca: rota.query.busca, situacao: rota.query.situacao })),
})

const situacaoAtual = computed(() => String(rota.query.situacao ?? ''))

function formatarData(valor: string | Date | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          Praticantes
        </h1>
        <p class="text-sm text-muted">
          {{ data?.filiados ?? 0 }} filiados · {{ data?.total ?? 0 }} nesta lista
        </p>
      </div>
      <ULink
        to="/praticantes/novo"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Novo praticante
      </ULink>
    </div>

    <!-- Busca por GET: o resultado fica no endereço e pode ser guardado. -->
    <form
      method="get"
      action="/praticantes"
      class="mt-6 flex gap-2 flex-wrap"
    >
      <input
        name="busca"
        :value="rota.query.busca"
        placeholder="Buscar por nome ou e-mail"
        class="flex-1 min-w-60 rounded-md border border-default bg-default px-3 py-2"
      >
      <select
        name="situacao"
        class="rounded-md border border-default bg-default px-3 py-2"
      >
        <option
          value=""
          :selected="situacaoAtual === ''"
        >
          Todos
        </option>
        <option
          value="FILIADOS"
          :selected="situacaoAtual === 'FILIADOS'"
        >
          Filiados
        </option>
        <option
          value="DESLIGADOS"
          :selected="situacaoAtual === 'DESLIGADOS'"
        >
          Desligados
        </option>
      </select>
      <button
        type="submit"
        class="rounded-md border border-default px-4 py-2"
      >
        Filtrar
      </button>
    </form>

    <div
      v-if="!data?.praticantes.length"
      class="mt-10 text-center text-muted"
    >
      Nenhum praticante encontrado.
    </div>

    <!-- Documento e observações médicas não aparecem aqui: ver PLANO.md §11. -->
    <div
      v-else
      class="mt-6 overflow-x-auto"
    >
      <table class="w-full text-sm">
        <thead class="text-left text-muted border-b border-default">
          <tr>
            <th class="py-2 pr-4">
              Nome
            </th>
            <th class="py-2 pr-4">
              Situação
            </th>
            <th class="py-2 pr-4">
              Modalidades
            </th>
            <th class="py-2 pr-4">
              Nascimento
            </th>
            <th class="py-2">
              Contato
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="praticante in data.praticantes"
            :key="praticante.id"
            class="border-b border-default"
          >
            <td class="py-2 pr-4">
              <ULink :to="`/praticantes/${praticante.id}`">
                {{ praticante.nomeCompleto }}
              </ULink>
            </td>
            <td class="py-2 pr-4">
              <UBadge
                :color="praticante.filiado ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ praticante.filiado ? 'Filiado' : 'Desligado' }}
              </UBadge>
            </td>
            <td class="py-2 pr-4">
              {{ praticante.modalidades.join(', ') || '—' }}
            </td>
            <td class="py-2 pr-4">
              {{ formatarData(praticante.dataNascimento) }}
            </td>
            <td class="py-2">
              {{ praticante.telefone }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
