<script setup lang="ts">
/**
 * Rótulo + campo, com a mesma aparência em todo formulário.
 *
 * Não usa v-model de propósito: os formulários deste projeto são enviados de
 * forma nativa, então o que importa é o atributo `name` e o valor inicial.
 */
const props = withDefaults(defineProps<{
  nome: string
  rotulo: string
  tipo?: string
  valor?: string | number | null
  obrigatorio?: boolean
  multilinha?: boolean
  ajuda?: string
  autocomplete?: string
  placeholder?: string
}>(), {
  tipo: 'text',
  valor: '',
  obrigatorio: false,
  multilinha: false,
  ajuda: undefined,
  autocomplete: undefined,
  placeholder: undefined,
})

// Interpolação dentro de <textarea> não funciona no Vue: o conteúdo inicial
// precisa vir por v-model. O envio continua nativo, pelo atributo `name`.
const conteudo = ref(String(props.valor ?? ''))

const classes = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div>
    <label
      :for="nome"
      class="block text-sm font-medium mb-1"
    >
      {{ rotulo }}<span
        v-if="obrigatorio"
        class="text-error"
      > *</span>
    </label>

    <textarea
      v-if="multilinha"
      :id="nome"
      v-model="conteudo"
      :name="nome"
      :required="obrigatorio"
      :placeholder="placeholder"
      rows="3"
      :class="classes"
    />

    <input
      v-else
      :id="nome"
      :name="nome"
      :type="tipo"
      :value="valor ?? ''"
      :required="obrigatorio"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :class="classes"
    >

    <p
      v-if="ajuda"
      class="mt-1 text-xs text-muted"
    >
      {{ ajuda }}
    </p>
  </div>
</template>
