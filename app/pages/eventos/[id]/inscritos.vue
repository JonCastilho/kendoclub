<script setup lang="ts">
import { formatarReais } from '~~/shared/dinheiro'
import { type InscritosDoEvento, ROTULO_DO_TIPO, formatarDia } from '~~/shared/evento'

definePageMeta({ middleware: 'diretoria' })

const id = useRoute().params.id as string
const { data } = await useFetch<InscritosDoEvento>(`/api/eventos/${id}/inscritos`)

useHead({ title: () => `Inscritos em ${data.value?.evento.titulo ?? ''} - KendoClub` })

const naoFiliados = computed(() => (data.value?.inscritos ?? []).filter(i => !i.filiado).length)
</script>

<template>
  <div
    v-if="data"
    class="max-w-5xl mx-auto px-4 py-10"
  >
    <h1 class="text-2xl font-bold">
      Inscritos
    </h1>
    <p class="text-muted">
      {{ data.evento.titulo }}
    </p>

    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <UCard>
        <div class="text-sm text-muted">
          Inscrições
        </div>
        <div class="text-3xl font-bold">
          {{ data.inscritos.length }}
        </div>
        <div
          v-if="naoFiliados"
          class="text-sm text-muted"
        >
          {{ naoFiliados }} não filiado(s) ao clube
        </div>
      </UCard>

      <UCard v-if="data.evento.diasObento.length">
        <div class="text-sm text-muted">
          Obentos a encomendar
        </div>
        <ul class="mt-1 text-sm">
          <li
            v-for="dia in data.evento.diasObento"
            :key="dia"
          >
            {{ formatarDia(dia) }}: <strong>{{ data.totaisDeObento[dia] ?? 0 }}</strong>
          </li>
        </ul>
      </UCard>

      <UCard>
        <div class="text-sm text-muted">
          Total estimado
        </div>
        <div class="text-3xl font-bold">
          {{ formatarReais(data.total) }}
        </div>
        <div
          v-if="data.evento.ofereceAlojamento"
          class="text-sm text-muted"
        >
          {{ data.comAlojamento }} com alojamento
        </div>
      </UCard>
    </div>

    <p
      v-if="!data.inscritos.length"
      class="mt-10 text-center text-muted"
    >
      Ninguém inscrito ainda.
    </p>

    <div
      v-else
      class="mt-8 overflow-x-auto"
    >
      <table class="w-full text-sm">
        <caption class="sr-only">
          Inscritos no evento, com subeventos, alojamento e obentos de cada pessoa
        </caption>
        <thead>
          <tr class="border-b border-default text-left">
            <th
              scope="col"
              class="py-2 pr-4"
            >
              Nome
            </th>
            <th
              scope="col"
              class="py-2 pr-4"
            >
              Filiado
            </th>
            <th
              v-for="subevento in data.subeventos"
              :key="subevento.id"
              scope="col"
              class="py-2 pr-4"
            >
              {{ ROTULO_DO_TIPO[subevento.tipo] }} de {{ subevento.modalidade.nome }}
              <span class="font-normal text-muted">({{ subevento.inscritos }})</span>
            </th>
            <th
              v-if="data.evento.ofereceAlojamento"
              scope="col"
              class="py-2 pr-4"
            >
              Alojamento
            </th>
            <th
              v-for="dia in data.evento.diasObento"
              :key="dia"
              scope="col"
              class="py-2 pr-4"
            >
              Obento {{ formatarDia(dia) }}
            </th>
            <th
              scope="col"
              class="py-2 text-right"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="inscrito in data.inscritos"
            :key="inscrito.praticanteId"
            class="border-b border-default"
          >
            <th
              scope="row"
              class="py-2 pr-4 text-left font-normal"
            >
              <ULink :to="`/agenda/${data.evento.slug}?praticante=${inscrito.praticanteId}`">
                {{ inscrito.nome }}
              </ULink>
            </th>
            <td class="py-2 pr-4">
              <UBadge
                :color="inscrito.filiado ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ inscrito.filiado ? 'sim' : 'não' }}
              </UBadge>
            </td>
            <td
              v-for="subevento in data.subeventos"
              :key="subevento.id"
              class="py-2 pr-4"
            >
              {{ inscrito.subeventoIds.includes(subevento.id) ? 'sim' : '—' }}
            </td>
            <td
              v-if="data.evento.ofereceAlojamento"
              class="py-2 pr-4"
            >
              {{ inscrito.alojamento ? 'sim' : '—' }}
            </td>
            <td
              v-for="dia in data.evento.diasObento"
              :key="dia"
              class="py-2 pr-4"
            >
              {{ inscrito.obentos[dia] ?? '—' }}
            </td>
            <td class="py-2 text-right">
              {{ formatarReais(inscrito.total) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-sm text-muted">
      Para mudar a inscrição de alguém, clique no nome: abre a página do evento
      já inscrevendo aquela pessoa.
    </p>

    <div class="mt-8 flex gap-4 text-sm">
      <ULink :to="`/eventos/${data.evento.id}`">
        Editar evento
      </ULink>
      <ULink :to="`/agenda/${data.evento.slug}`">
        Ver na agenda
      </ULink>
    </div>
  </div>
</template>
