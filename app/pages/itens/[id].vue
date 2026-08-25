<script setup lang="ts">
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'diretoria' })

const id = useRoute().params.id as string
const { data: item } = await useFetch(`/api/itens/${id}`)

useHead({ title: () => `${item.value?.nome ?? 'Item'} - KendoClub` })

const hoje = new Date().toISOString().slice(0, 10)

function data(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const classeCampo = 'rounded-md border border-default bg-default px-3 py-2'
const classeBotao = 'rounded-md border border-default px-3 py-2 text-sm'
</script>

<template>
  <div
    v-if="item"
    class="max-w-3xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      {{ item.nome }}
      <span
        v-if="item.identificador"
        class="text-muted font-normal"
      >· {{ item.identificador }}</span>
    </h1>
    <p class="mt-1 text-sm text-muted">
      {{ formatarReais(item.valorMensalAluguel) }} por mês
    </p>

    <UAlert
      v-if="item.aluguelAtual"
      class="mt-6"
      color="warning"
      variant="subtle"
      title="Está alugado"
    >
      <template #description>
        Com
        <ULink :to="`/praticantes/${item.aluguelAtual.praticante.id}`">
          {{ item.aluguelAtual.praticante.nomeCompleto }}
        </ULink>
        desde {{ data(item.aluguelAtual.inicioEm) }}, por
        {{ formatarReais(item.aluguelAtual.valorMensal) }}/mês.
      </template>
    </UAlert>

    <!-- Devolver, quando está com alguém; alugar, quando está livre. -->
    <section class="mt-6">
      <form
        v-if="item.aluguelAtual"
        method="post"
        :action="`/api/itens/${id}/alugueis`"
        class="flex gap-2 flex-wrap items-end"
      >
        <input
          type="hidden"
          name="acao"
          value="devolver"
        >
        <div>
          <label
            for="fimEm"
            class="block text-sm font-medium mb-1"
          >Devolvido em</label>
          <input
            id="fimEm"
            type="date"
            name="fimEm"
            :value="hoje"
            required
            :class="classeCampo"
          >
        </div>
        <input
          name="observacao"
          placeholder="Observação (estado do item)"
          :class="classeCampo"
        >
        <button
          type="submit"
          :class="classeBotao"
        >
          Registrar devolução
        </button>
      </form>

      <form
        v-else-if="item.situacao === 'DISPONIVEL'"
        method="post"
        :action="`/api/itens/${id}/alugueis`"
        class="flex gap-2 flex-wrap items-end"
      >
        <div>
          <label
            for="praticanteId"
            class="block text-sm font-medium mb-1"
          >Alugar para</label>
          <select
            id="praticanteId"
            name="praticanteId"
            required
            :class="classeCampo"
          >
            <option
              v-for="candidato in item.candidatos"
              :key="candidato.id"
              :value="candidato.id"
            >
              {{ candidato.nomeCompleto }}
            </option>
          </select>
        </div>
        <div>
          <label
            for="inicioEm"
            class="block text-sm font-medium mb-1"
          >Retirada em</label>
          <input
            id="inicioEm"
            type="date"
            name="inicioEm"
            :value="hoje"
            required
            :class="classeCampo"
          >
        </div>
        <button
          type="submit"
          :class="classeBotao"
        >
          Registrar aluguel
        </button>
      </form>

      <p
        v-else
        class="text-sm text-muted"
      >
        Item {{ item.situacao === 'MANUTENCAO' ? 'em manutenção' : 'baixado' }} não pode ser alugado.
      </p>
    </section>

    <section class="mt-10">
      <h2 class="font-semibold mb-3">
        Histórico de aluguéis
      </h2>
      <ul
        v-if="item.alugueis.length"
        class="text-sm divide-y divide-default border-y border-default"
      >
        <li
          v-for="aluguel in item.alugueis"
          :key="aluguel.id"
          class="py-2"
        >
          <ULink :to="`/praticantes/${aluguel.praticante.id}`">
            {{ aluguel.praticante.nomeCompleto }}
          </ULink>
          <span class="text-muted">
            · {{ data(aluguel.inicioEm) }} até
            {{ aluguel.fimEm ? data(aluguel.fimEm) : 'hoje' }}
            · {{ formatarReais(aluguel.valorMensal) }}/mês
          </span>
          <span
            v-if="aluguel.observacao"
            class="text-muted"
          > · {{ aluguel.observacao }}</span>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        Este item nunca foi alugado.
      </p>
    </section>

    <section class="mt-10 mb-16">
      <h2 class="font-semibold mb-3">
        Dados do item
      </h2>
      <form
        method="post"
        action="/api/itens"
        class="grid gap-3 sm:grid-cols-2"
      >
        <input
          type="hidden"
          name="id"
          :value="id"
        >
        <CampoTexto
          nome="nome"
          rotulo="Nome"
          obrigatorio
          :valor="item.nome"
        />
        <CampoTexto
          nome="identificador"
          rotulo="Patrimônio"
          :valor="item.identificador"
        />
        <CampoTexto
          nome="tipo"
          rotulo="Tipo"
          :valor="item.tipo"
        />
        <CampoTexto
          nome="valorMensalAluguel"
          rotulo="Aluguel mensal"
          :valor="String(item.valorMensalAluguel)"
          ajuda="Vale para novos aluguéis; os em andamento mantêm o valor combinado."
        />
        <div>
          <label
            for="situacao"
            class="block text-sm font-medium mb-1"
          >Situação</label>
          <select
            id="situacao"
            name="situacao"
            :class="classeCampo"
          >
            <option
              value="DISPONIVEL"
              :selected="item.situacao === 'DISPONIVEL'"
            >
              Disponível
            </option>
            <option
              value="MANUTENCAO"
              :selected="item.situacao === 'MANUTENCAO'"
            >
              Em manutenção
            </option>
            <option
              value="BAIXADO"
              :selected="item.situacao === 'BAIXADO'"
            >
              Baixado
            </option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <CampoTexto
            nome="observacoes"
            rotulo="Observações"
            multilinha
            :valor="item.observacoes"
          />
        </div>
        <div class="sm:col-span-2 flex gap-3">
          <button
            type="submit"
            class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
          >
            Salvar
          </button>
          <ULink
            to="/itens"
            class="px-4 py-2"
          >
            Voltar
          </ULink>
        </div>
      </form>
    </section>
  </div>
</template>
