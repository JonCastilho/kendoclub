<script setup lang="ts">
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Itens - KendoClub' })

const rota = useRoute()
const { data } = await useFetch('/api/itens', {
  query: computed(() => ({ situacao: rota.query.situacao })),
})

const situacaoAtual = computed(() => String(rota.query.situacao ?? ''))

const ROTULOS: Record<string, string> = {
  DISPONIVEL: 'Disponível',
  MANUTENCAO: 'Em manutenção',
  BAIXADO: 'Baixado',
}

const classeCampo = 'rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Itens alugáveis
    </h1>
    <p class="text-sm text-muted">
      {{ data?.alugados ?? 0 }} alugados · {{ data?.disponiveis ?? 0 }} disponíveis
    </p>

    <form
      method="get"
      action="/itens"
      class="mt-6 flex gap-2"
    >
      <select
        name="situacao"
        :class="classeCampo"
      >
        <option
          value=""
          :selected="situacaoAtual === ''"
        >
          Todos
        </option>
        <option
          value="ALUGADOS"
          :selected="situacaoAtual === 'ALUGADOS'"
        >
          Alugados
        </option>
        <option
          value="DISPONIVEIS"
          :selected="situacaoAtual === 'DISPONIVEIS'"
        >
          Disponíveis
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
      v-if="!data?.itens.length"
      class="mt-10 text-center text-muted"
    >
      Nenhum item cadastrado ainda.
    </div>

    <div
      v-else
      class="mt-6 overflow-x-auto"
    >
      <table class="w-full text-sm">
        <thead class="text-left text-muted border-b border-default">
          <tr>
            <th class="py-2 pr-4">
              Item
            </th>
            <th class="py-2 pr-4">
              Situação
            </th>
            <th class="py-2 pr-4">
              Com quem
            </th>
            <th class="py-2">
              Aluguel
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in data.itens"
            :key="item.id"
            class="border-b border-default"
          >
            <td class="py-2 pr-4">
              <ULink :to="`/itens/${item.id}`">
                {{ item.nome }}
              </ULink>
              <span
                v-if="item.identificador"
                class="text-muted"
              > · {{ item.identificador }}</span>
            </td>
            <td class="py-2 pr-4">
              <UBadge
                v-if="item.alugado"
                color="warning"
                variant="subtle"
              >
                Alugado
              </UBadge>
              <UBadge
                v-else
                :color="item.situacao === 'DISPONIVEL' ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ ROTULOS[item.situacao] }}
              </UBadge>
            </td>
            <td class="py-2 pr-4">
              <ULink
                v-if="item.comQuem"
                :to="`/praticantes/${item.comQuem.id}`"
              >
                {{ item.comQuem.nomeCompleto }}
              </ULink>
              <span v-else>—</span>
            </td>
            <td class="py-2">
              {{ formatarReais(item.valorMensalAluguel) }}/mês
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section class="mt-10">
      <h2 class="font-semibold mb-3">
        Novo item
      </h2>
      <form
        method="post"
        action="/api/itens"
        class="grid gap-3 sm:grid-cols-2"
      >
        <CampoTexto
          nome="nome"
          rotulo="Nome"
          obrigatorio
          placeholder="Bogu completo"
        />
        <CampoTexto
          nome="identificador"
          rotulo="Patrimônio"
          placeholder="BG-014"
          ajuda="Serve para diferenciar dois itens iguais."
        />
        <CampoTexto
          nome="tipo"
          rotulo="Tipo"
          placeholder="Bogu"
        />
        <CampoTexto
          nome="valorMensalAluguel"
          rotulo="Aluguel mensal"
          placeholder="0,00"
        />
        <div class="sm:col-span-2">
          <button
            type="submit"
            class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
          >
            Cadastrar item
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
