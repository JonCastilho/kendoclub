<script setup lang="ts">
import type { Grau } from '@prisma/client'
import { GRAUS_DE_EXAME, SHOGOS } from '~~/shared/exame'
import { KYU_MAXIMO, ROTULO_DO_SHOGO, type Shogo, grausDaModalidade, rotuloDoGrau } from '~~/shared/graduacao'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Modalidades - KendoClub' })

const { data: modalidades } = await useFetch('/api/modalidades')

/** Exames da modalidade — graduações e shogos —, com os meses já gravados. */
function linhasDeCarencia(
  kyuInicial: number,
  carencias: Array<{ grau: Grau | null, shogo: Shogo | null, mesesMinimos: number }>,
) {
  const graus = grausDaModalidade(kyuInicial)
  return [
    ...GRAUS_DE_EXAME.filter(grau => graus.includes(grau)).map(grau => ({
      chave: grau, rotulo: rotuloDoGrau(grau),
      meses: carencias.find(c => c.grau === grau)?.mesesMinimos ?? null,
    })),
    ...SHOGOS.map(shogo => ({
      chave: shogo, rotulo: ROTULO_DO_SHOGO[shogo],
      meses: carencias.find(c => c.shogo === shogo)?.mesesMinimos ?? null,
    })),
  ]
}

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

        <!-- <details> abre e fecha sem JavaScript. -->
        <details class="mt-2">
          <summary class="cursor-pointer text-sm">
            Carência para exame
            <span class="text-muted">
              ({{ modalidade.carencias.length ? `${modalidade.carencias.length} regra(s)` : 'nenhuma regra' }})
            </span>
          </summary>

          <form
            method="post"
            action="/api/modalidades/carencias"
            class="mt-3 flex flex-col gap-3"
          >
            <input
              type="hidden"
              name="modalidadeId"
              :value="modalidade.id"
            >
            <p class="text-sm text-muted">
              Meses mínimos desde a última graduação para prestar cada exame —
              de dan ou de shogo —, contados até o primeiro dia do exame. Quem tem
              título confere a linha do dan: 5º dan Renshi que presta 6º dan usa
              a carência de 6º dan. Quem não cumpre é inscrito
              normalmente e aparece com aviso na lista de inscritos. Deixe em
              branco para não conferir.
            </p>
            <div class="grid gap-2 grid-cols-3 sm:grid-cols-5">
              <label
                v-for="linha in linhasDeCarencia(modalidade.kyuInicial, modalidade.carencias)"
                :key="linha.chave"
                class="text-sm"
              >
                {{ linha.rotulo }}
                <input
                  :name="`meses_${linha.chave}`"
                  inputmode="numeric"
                  placeholder="meses"
                  :value="linha.meses ?? ''"
                  :class="[classeCampo, 'w-full']"
                >
              </label>
            </div>
            <div>
              <button
                type="submit"
                class="rounded-md border border-default px-3 py-2 text-sm"
              >
                Salvar carência
              </button>
            </div>
          </form>
        </details>
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
