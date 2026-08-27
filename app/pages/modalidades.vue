<script setup lang="ts">
import { KYU_MAXIMO } from '~~/shared/graduacao'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Modalidades - KendoClub' })

const { data: modalidades } = await useFetch('/api/modalidades')

const kyus = Array.from({ length: KYU_MAXIMO }, (_, i) => i + 1)
const classeCampo = 'rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10">
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Modalidades
    </h1>
    <p class="mt-1 text-sm text-muted">
      O kyu inicial define onde começa a lista de graduações de cada modalidade.
    </p>

    <ul class="mt-6 divide-y divide-default border-y border-default">
      <li
        v-for="modalidade in modalidades"
        :key="modalidade.id"
        class="py-3"
      >
        <form
          method="post"
          action="/api/modalidades"
          class="flex items-center gap-2 flex-wrap"
        >
          <input
            type="hidden"
            name="id"
            :value="modalidade.id"
          >
          <input
            name="nome"
            :value="modalidade.nome"
            aria-label="Nome da modalidade"
            required
            :class="classeCampo"
          >
          <label class="text-sm text-muted">
            começa no
            <select
              name="kyuInicial"
              :class="classeCampo"
            >
              <option
                v-for="kyu in kyus"
                :key="kyu"
                :value="kyu"
                :selected="modalidade.kyuInicial === kyu"
              >
                {{ kyu }}º kyu
              </option>
            </select>
          </label>
          <label class="text-sm flex items-center gap-1">
            <input
              type="checkbox"
              name="ativa"
              :checked="modalidade.ativa"
            >
            ativa
          </label>
          <span class="text-sm text-muted">
            {{ modalidade._count.praticantes }} praticante(s)
          </span>
          <button
            type="submit"
            class="rounded-md border border-default px-3 py-2 text-sm"
          >
            Salvar
          </button>
        </form>
      </li>
    </ul>

    <form
      method="post"
      action="/api/modalidades"
      class="mt-6 flex items-end gap-2 flex-wrap"
    >
      <div>
        <label
          for="nome"
          class="block text-sm font-medium mb-1"
        >Nova modalidade</label>
        <input
          id="nome"
          name="nome"
          required
          placeholder="Naginata"
          :class="classeCampo"
        >
      </div>
      <label class="text-sm text-muted">
        começa no
        <select
          name="kyuInicial"
          :class="classeCampo"
        >
          <option
            v-for="kyu in kyus"
            :key="kyu"
            :value="kyu"
            :selected="kyu === 6"
          >
            {{ kyu }}º kyu
          </option>
        </select>
      </label>
      <input
        type="hidden"
        name="ativa"
        value="on"
      >
      <button
        type="submit"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Adicionar
      </button>
    </form>
  </div>
</template>
