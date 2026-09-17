<script setup lang="ts">
import { ROTULO_DO_TIPO, type SubeventoDetalhado, type TipoSubevento } from '~~/shared/evento'

/** Criação e edição de subevento: mesmo formulário, com ou sem `subevento`. */
const props = defineProps<{
  eventoId: string
  subevento?: SubeventoDetalhado
  modalidades: Array<{ id: string, nome: string }>
  tipos: TipoSubevento[]
  vagasDeDia: string[]
  valorNoCampo: string
  pedeConfirmacao: boolean
}>()

// Prefixo para os ids dos campos não se repetirem entre os vários formulários
// da mesma página — rótulo ligado ao campo errado confunde o leitor de tela.
const prefixo = props.subevento?.id ?? 'novo'

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <form
    method="post"
    action="/api/eventos/subeventos"
    class="mt-3 flex flex-col gap-3"
  >
    <input
      type="hidden"
      name="eventoId"
      :value="eventoId"
    >
    <input
      v-if="subevento"
      type="hidden"
      name="id"
      :value="subevento.id"
    >

    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label
          :for="subevento ? undefined : `${prefixo}-tipo`"
          class="block text-sm font-medium mb-1"
        >Tipo</label>
        <!-- O tipo não muda depois de criado; para trocar, remove-se o subevento. -->
        <template v-if="subevento">
          <input
            type="hidden"
            name="tipo"
            :value="subevento.tipo"
          >
          <p class="py-2">
            {{ ROTULO_DO_TIPO[subevento.tipo] }}
          </p>
        </template>
        <select
          v-else
          :id="`${prefixo}-tipo`"
          name="tipo"
          :class="classeCampo"
        >
          <option
            v-for="tipo in tipos"
            :key="tipo"
            :value="tipo"
          >
            {{ ROTULO_DO_TIPO[tipo] }}
          </option>
        </select>
      </div>

      <div>
        <label
          :for="`${prefixo}-modalidade`"
          class="block text-sm font-medium mb-1"
        >Modalidade</label>
        <select
          :id="`${prefixo}-modalidade`"
          name="modalidadeId"
          required
          :class="classeCampo"
        >
          <option
            value=""
            disabled
            :selected="!subevento"
          >
            Escolha
          </option>
          <option
            v-for="modalidade in modalidades"
            :key="modalidade.id"
            :value="modalidade.id"
            :selected="subevento?.modalidade.id === modalidade.id"
          >
            {{ modalidade.nome }}
          </option>
        </select>
      </div>
    </div>

    <div>
      <label
        :for="`${prefixo}-local`"
        class="block text-sm font-medium mb-1"
      >Local</label>
      <input
        :id="`${prefixo}-local`"
        name="local"
        required
        :value="subevento?.local ?? ''"
        :class="classeCampo"
      >
    </div>

    <fieldset>
      <legend class="text-sm font-medium mb-1">
        Dias
      </legend>
      <div class="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <input
          v-for="(dia, indice) in vagasDeDia"
          :key="indice"
          type="date"
          :name="`dia_${indice + 1}`"
          :value="dia"
          :aria-label="`Dia ${indice + 1}`"
          :class="classeCampo"
        >
      </div>
    </fieldset>

    <div
      v-if="!subevento || subevento.tipo !== 'EXAME'"
      class="max-w-xs"
    >
      <label
        :for="`${prefixo}-valor`"
        class="block text-sm font-medium mb-1"
      >Valor de participação</label>
      <input
        :id="`${prefixo}-valor`"
        name="valor"
        inputmode="decimal"
        placeholder="0,00"
        :value="valorNoCampo"
        :class="classeCampo"
      >
      <p class="mt-1 text-xs text-muted">
        Use 0 se for gratuito. Na competição, o valor cobre individual e equipe, e
        cada categoria pode ser marcada como isenta.
      </p>
    </div>

    <label
      v-if="pedeConfirmacao"
      class="flex items-start gap-2 text-sm"
    >
      <input
        type="checkbox"
        name="confirmarApagarObentos"
        class="mt-1"
      >
      Se tirar um dia que tem obento encomendado, apagar essas encomendas.
    </label>

    <div>
      <button
        type="submit"
        class="rounded-md border border-default px-4 py-2"
      >
        {{ subevento ? 'Salvar subevento' : 'Adicionar subevento' }}
      </button>
    </div>
  </form>
</template>
