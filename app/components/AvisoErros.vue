<script setup lang="ts">
/**
 * Mostra os problemas de validação, venham eles da resposta em JSON (envio com
 * JavaScript) ou da query `?erros=` (envio nativo, sem JavaScript).
 */
const props = defineProps<{ problemas?: string[] }>()

const rota = useRoute()

const daQuery = computed(() => {
  const bruto = rota.query.erros
  return typeof bruto === 'string' && bruto ? bruto.split('|') : []
})

const lista = computed(() => (props.problemas?.length ? props.problemas : daQuery.value))
</script>

<template>
  <UAlert
    v-if="lista.length"
    class="mb-4"
    color="error"
    variant="subtle"
    :title="lista.length === 1 ? 'Corrija antes de salvar' : `${lista.length} pontos a corrigir`"
  >
    <template #description>
      <ul class="list-disc pl-4">
        <li
          v-for="problema in lista"
          :key="problema"
        >
          {{ problema }}
        </li>
      </ul>
    </template>
  </UAlert>
</template>
