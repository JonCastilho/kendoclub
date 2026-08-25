<script setup lang="ts">
import { formatarCompetencia } from '~~/shared/competencia'
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'autenticado' })
useHead({ title: 'Minhas mensalidades - KendoClub' })

const { data } = await useFetch('/api/mensalidades/minhas')

const CORES = {
  ABERTA: 'warning',
  PAGA: 'success',
  ISENTA: 'info',
  CANCELADA: 'neutral',
} as const

const cor = (situacao: string) => CORES[situacao as keyof typeof CORES]

const ROTULOS: Record<string, string> = {
  ABERTA: 'em aberto',
  PAGA: 'paga',
  ISENTA: 'isenta',
  CANCELADA: 'cancelada',
}

function data_(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const copiada = ref(false)
async function copiarPix() {
  if (!data.value?.chavePix) return
  await navigator.clipboard.writeText(data.value.chavePix)
  copiada.value = true
  setTimeout(() => (copiada.value = false), 2000)
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <h1 class="text-2xl font-bold">
      Minhas mensalidades
    </h1>

    <UAlert
      v-if="data?.emAberto"
      class="mt-4"
      color="warning"
      variant="subtle"
      :title="`${formatarReais(data.emAberto)} em aberto`"
    >
      <template #description>
        <div v-if="data.chavePix">
          Pague por Pix na chave
          <strong>{{ data.chavePix }}</strong>
          <span v-if="data.titularPix"> ({{ data.titularPix }})</span>.
          <!-- Copiar a chave é o passo mais chato de fazer no celular. -->
          <button
            type="button"
            class="ml-1 underline"
            @click="copiarPix"
          >
            {{ copiada ? 'copiada!' : 'copiar chave' }}
          </button>
          <br>
          Depois de pagar, avise a diretoria para dar baixa.
        </div>
        <div v-else>
          Procure a diretoria para acertar o pagamento.
        </div>
      </template>
    </UAlert>

    <div
      v-if="!data?.mensalidades.length"
      class="mt-10 text-center text-muted"
    >
      Você ainda não tem mensalidades registradas.
    </div>

    <ul
      v-else
      class="mt-6 divide-y divide-default border-y border-default"
    >
      <li
        v-for="mensalidade in data.mensalidades"
        :key="mensalidade.id"
        class="py-3 flex items-start justify-between gap-4"
      >
        <div>
          <div class="font-medium">
            {{ formatarCompetencia(mensalidade.competencia) }}
            <UBadge
              class="ml-1"
              :color="cor(mensalidade.situacao)"
              variant="subtle"
            >
              {{ ROTULOS[mensalidade.situacao] }}
            </UBadge>
          </div>

          <!-- As linhas explicam o valor: mensalidade e cada aluguel. -->
          <ul class="mt-1 text-sm text-muted">
            <li
              v-for="linha in mensalidade.linhas"
              :key="linha.id"
            >
              {{ linha.descricao }} — {{ formatarReais(linha.valor) }}
            </li>
          </ul>

          <p
            v-if="mensalidade.situacao === 'PAGA'"
            class="mt-1 text-xs text-muted"
          >
            Pago em {{ data_(mensalidade.pagaEm) }}
          </p>
        </div>

        <div class="text-right whitespace-nowrap">
          <div class="font-semibold">
            {{ formatarReais(mensalidade.valorTotal) }}
          </div>
          <div class="text-xs text-muted">
            vence {{ data_(mensalidade.vencimento) }}
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
