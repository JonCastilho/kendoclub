<script setup lang="ts">
import { ROTULO_DO_SEXO, type SexoCategoria } from '~~/shared/competicao'
import type { CategoriaDetalhada } from '~~/shared/evento'
import { grausDaModalidade, rotuloDoGrau } from '~~/shared/graduacao'

/** Criação e edição de categoria: mesmo formulário, com ou sem `categoria`. */
const props = defineProps<{
  subeventoId: string
  kyuInicial: number
  categoria?: CategoriaDetalhada
}>()

const prefixo = props.categoria?.id ?? `nova-${props.subeventoId}`
const graus = computed(() => grausDaModalidade(props.kyuInicial))
const sexos = Object.keys(ROTULO_DO_SEXO) as SexoCategoria[]

const classeCampo = 'w-full rounded-md border border-default bg-default px-2 py-1'
</script>

<template>
  <form
    method="post"
    action="/api/eventos/categorias"
    class="grid gap-2 sm:grid-cols-12 items-end text-sm"
  >
    <input
      type="hidden"
      name="subeventoId"
      :value="subeventoId"
    >
    <input
      v-if="categoria"
      type="hidden"
      name="id"
      :value="categoria.id"
    >

    <div class="sm:col-span-3">
      <label
        :for="`${prefixo}-nome`"
        class="block text-xs text-muted"
      >Nome</label>
      <input
        :id="`${prefixo}-nome`"
        name="nome"
        required
        placeholder="Adulto masculino"
        :value="categoria?.nome ?? ''"
        :class="classeCampo"
      >
    </div>

    <div class="sm:col-span-2">
      <label
        :for="`${prefixo}-sexo`"
        class="block text-xs text-muted"
      >Sexo</label>
      <select
        :id="`${prefixo}-sexo`"
        name="sexo"
        required
        :class="classeCampo"
      >
        <option
          v-for="sexo in sexos"
          :key="sexo"
          :value="sexo"
          :selected="(categoria?.sexo ?? 'MISTO') === sexo"
        >
          {{ ROTULO_DO_SEXO[sexo] }}
        </option>
      </select>
    </div>

    <fieldset class="sm:col-span-2 grid grid-cols-2 gap-1">
      <legend class="text-xs text-muted">
        Idade no ano
      </legend>
      <input
        name="idadeMinima"
        inputmode="numeric"
        placeholder="de"
        aria-label="Idade mínima"
        :value="categoria?.idadeMinima ?? ''"
        :class="classeCampo"
      >
      <input
        name="idadeMaxima"
        inputmode="numeric"
        placeholder="até"
        aria-label="Idade máxima"
        :value="categoria?.idadeMaxima ?? ''"
        :class="classeCampo"
      >
    </fieldset>

    <fieldset class="sm:col-span-3 grid grid-cols-2 gap-1">
      <legend class="text-xs text-muted">
        Graduação
      </legend>
      <select
        name="grauMinimo"
        aria-label="Graduação mínima"
        :class="classeCampo"
      >
        <option
          value=""
          :selected="!categoria?.grauMinimo"
        >
          qualquer
        </option>
        <option
          v-for="grau in graus"
          :key="grau"
          :value="grau"
          :selected="categoria?.grauMinimo === grau"
        >
          {{ rotuloDoGrau(grau) }}
        </option>
      </select>
      <select
        name="grauMaximo"
        aria-label="Graduação máxima"
        :class="classeCampo"
      >
        <option
          value=""
          :selected="!categoria?.grauMaximo"
        >
          qualquer
        </option>
        <option
          v-for="grau in graus"
          :key="grau"
          :value="grau"
          :selected="categoria?.grauMaximo === grau"
        >
          {{ rotuloDoGrau(grau) }}
        </option>
      </select>
    </fieldset>

    <label class="sm:col-span-1 flex items-center gap-1 pb-1">
      <input
        type="checkbox"
        name="isenta"
        :checked="categoria?.isenta"
      >
      Isenta
    </label>

    <div class="sm:col-span-1">
      <button
        type="submit"
        class="w-full rounded-md border border-default px-2 py-1"
      >
        {{ categoria ? 'Salvar' : 'Adicionar' }}
      </button>
    </div>
  </form>
</template>
