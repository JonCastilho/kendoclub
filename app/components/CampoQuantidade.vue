<script setup lang="ts">
/**
 * Quantidade com botões de menos e mais, para evitar erro de digitação.
 *
 * O campo numérico é o que vai no formulário. Os botões só aparecem com
 * JavaScript; sem ele, o campo sozinho continua funcionando, com as setas do
 * teclado.
 */
const props = withDefaults(defineProps<{
  nome: string
  rotulo: string
  valor?: number
  minimo?: number
}>(), {
  valor: 0,
  minimo: 0,
})

const quantidade = ref(props.valor)
const montado = ref(false)

onMounted(() => {
  montado.value = true
})

function ajustar(passo: number) {
  const atual = Number.isFinite(quantidade.value) ? quantidade.value : props.minimo
  quantidade.value = Math.max(props.minimo, atual + passo)
}
</script>

<template>
  <div class="flex items-center justify-between gap-3">
    <label
      :for="nome"
      class="text-sm"
    >{{ rotulo }}</label>

    <div class="flex items-center gap-1">
      <UButton
        v-if="montado"
        type="button"
        size="sm"
        color="neutral"
        variant="outline"
        :aria-label="`Diminuir: ${rotulo}`"
        :disabled="quantidade <= minimo"
        @click="ajustar(-1)"
      >
        −
      </UButton>
      <input
        :id="nome"
        v-model.number="quantidade"
        :name="nome"
        type="number"
        inputmode="numeric"
        :min="minimo"
        step="1"
        class="w-16 rounded-md border border-default bg-default px-2 py-1 text-center"
      >
      <UButton
        v-if="montado"
        type="button"
        size="sm"
        color="neutral"
        variant="outline"
        :aria-label="`Aumentar: ${rotulo}`"
        @click="ajustar(1)"
      >
        +
      </UButton>
    </div>
  </div>
</template>
