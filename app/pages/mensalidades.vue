<script setup lang="ts">
import { competenciaAtual, formatarCompetencia } from '~~/shared/competencia'
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Mensalidades - KendoClub' })

const rota = useRoute()

const { data } = await useFetch('/api/mensalidades', {
  query: computed(() => ({
    competencia: rota.query.competencia,
    situacao: rota.query.situacao,
  })),
})

const competencia = computed(() => String(rota.query.competencia ?? competenciaAtual()))
const situacaoFiltro = computed(() => String(rota.query.situacao ?? ''))
const hoje = new Date().toISOString().slice(0, 10)

/** Resumo da geração, devolvido pelo endpoint na própria URL. */
const geracao = computed(() => {
  if (rota.query.criadas === undefined) return null
  return {
    criadas: Number(rota.query.criadas),
    isentas: Number(rota.query.isentas),
    jaExistiam: Number(rota.query.jaExistiam),
    semCobranca: Number(rota.query.semCobranca),
  }
})

const CORES = {
  ABERTA: 'warning',
  PAGA: 'success',
  ISENTA: 'info',
  CANCELADA: 'neutral',
} as const

const cor = (situacao: string) => CORES[situacao as keyof typeof CORES]

function data_(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const classeCampo = 'rounded-md border border-default bg-default px-3 py-2'
const classeBotao = 'rounded-md border border-default px-3 py-2 text-sm'
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10">
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Mensalidades
    </h1>
    <p class="text-sm text-muted">
      {{ formatarCompetencia(data?.competencia ?? competencia) }}
    </p>

    <UAlert
      v-if="geracao"
      class="mt-4"
      color="success"
      variant="subtle"
      title="Geração concluída"
      :description="`${geracao.criadas} cobrança(s) criada(s), sendo ${geracao.isentas} isenta(s). `
        + `${geracao.jaExistiam} já existiam e ${geracao.semCobranca} praticante(s) ficaram de fora `
        + `por não estarem filiados no primeiro dia do mês.`"
    />

    <div class="mt-6 grid gap-4 sm:grid-cols-4">
      <UCard>
        <div class="text-sm text-muted">
          Em aberto
        </div>
        <div class="text-2xl font-bold">
          {{ data?.abertas ?? 0 }}
        </div>
      </UCard>
      <UCard>
        <div class="text-sm text-muted">
          Pagas
        </div>
        <div class="text-2xl font-bold">
          {{ data?.pagas ?? 0 }}
        </div>
      </UCard>
      <UCard>
        <div class="text-sm text-muted">
          A receber
        </div>
        <div class="text-2xl font-bold">
          {{ formatarReais(data?.valorEmAberto) }}
        </div>
      </UCard>
      <UCard>
        <div class="text-sm text-muted">
          Total do mês
        </div>
        <div class="text-2xl font-bold">
          {{ formatarReais(data?.valorEsperado) }}
        </div>
      </UCard>
    </div>

    <div class="mt-6 flex gap-3 flex-wrap items-end">
      <form
        method="get"
        action="/mensalidades"
        class="flex gap-2 items-end"
      >
        <div>
          <label
            for="competencia"
            class="block text-sm font-medium mb-1"
          >Competência</label>
          <input
            id="competencia"
            type="month"
            name="competencia"
            :value="competencia"
            :class="classeCampo"
          >
        </div>
        <select
          name="situacao"
          aria-label="Filtrar cobranças por situação"
          :class="classeCampo"
        >
          <option
            value=""
            :selected="situacaoFiltro === ''"
          >
            Todas
          </option>
          <option
            value="ABERTA"
            :selected="situacaoFiltro === 'ABERTA'"
          >
            Em aberto
          </option>
          <option
            value="PAGA"
            :selected="situacaoFiltro === 'PAGA'"
          >
            Pagas
          </option>
          <option
            value="ISENTA"
            :selected="situacaoFiltro === 'ISENTA'"
          >
            Isentas
          </option>
        </select>
        <button
          type="submit"
          :class="classeBotao"
        >
          Ver
        </button>
      </form>

      <!-- Gerar é idempotente: rodar de novo não duplica cobrança. -->
      <form
        method="post"
        action="/api/mensalidades/gerar"
      >
        <input
          type="hidden"
          name="competencia"
          :value="competencia"
        >
        <button
          type="submit"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
        >
          Gerar cobranças do mês
        </button>
      </form>
    </div>

    <div
      v-if="!data?.mensalidades.length"
      class="mt-10 text-center text-muted"
    >
      Nenhuma cobrança nesta competência. Use "Gerar cobranças do mês".
    </div>

    <ul
      v-else
      class="mt-6 divide-y divide-default border-y border-default"
    >
      <li
        v-for="mensalidade in data.mensalidades"
        :key="mensalidade.id"
        class="py-3"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <ULink :to="`/praticantes/${mensalidade.praticante.id}`">
              {{ mensalidade.praticante.nomeCompleto }}
            </ULink>
            <UBadge
              class="ml-2"
              :color="cor(mensalidade.situacao)"
              variant="subtle"
            >
              {{ mensalidade.situacao.toLowerCase() }}
            </UBadge>

            <ul class="mt-1 text-sm text-muted">
              <li
                v-for="linha in mensalidade.linhas"
                :key="linha.id"
              >
                {{ linha.descricao }} — {{ formatarReais(linha.valor) }}
              </li>
            </ul>

            <p
              v-if="mensalidade.situacao === 'PAGA'"
              class="mt-1 text-xs text-muted"
            >
              Pago em {{ data_(mensalidade.pagaEm) }}
              ({{ formatarReais(mensalidade.valorPago) }}),
              baixa por {{ mensalidade.baixadaPor?.email ?? '—' }}
            </p>
          </div>

          <div class="text-right">
            <div class="font-semibold">
              {{ formatarReais(mensalidade.valorTotal) }}
            </div>
            <div class="text-xs text-muted">
              vence {{ data_(mensalidade.vencimento) }}
            </div>

            <form
              v-if="mensalidade.situacao === 'ABERTA'"
              method="post"
              :action="`/api/mensalidades/${mensalidade.id}/baixa`"
              class="mt-2 flex gap-2 flex-wrap justify-end"
            >
              <input
                type="date"
                name="pagaEm"
                aria-label="Data do pagamento"
                :value="hoje"
                required
                :class="classeCampo"
              >
              <button
                type="submit"
                :class="classeBotao"
              >
                Dar baixa
              </button>
            </form>

            <form
              v-else-if="mensalidade.situacao === 'PAGA'"
              method="post"
              :action="`/api/mensalidades/${mensalidade.id}/baixa`"
              class="mt-2"
            >
              <input
                type="hidden"
                name="acao"
                value="estornar"
              >
              <button
                type="submit"
                class="text-xs text-muted hover:text-default underline"
              >
                estornar baixa
              </button>
            </form>

            <!-- Ajustes fora do fluxo normal. A cobrança é um retrato do mês:
                 isenção concedida ou aluguel registrado depois da geração só
                 entram se alguém mandar recalcular. -->
            <div class="mt-1 flex gap-3 justify-end text-xs">
              <form
                v-if="mensalidade.situacao === 'ABERTA' || mensalidade.situacao === 'ISENTA'"
                method="post"
                :action="`/api/mensalidades/${mensalidade.id}/ajuste`"
              >
                <button
                  type="submit"
                  class="text-muted hover:text-default underline"
                >
                  recalcular
                </button>
              </form>

              <form
                v-if="mensalidade.situacao === 'ABERTA' || mensalidade.situacao === 'ISENTA'"
                method="post"
                :action="`/api/mensalidades/${mensalidade.id}/ajuste`"
              >
                <input
                  type="hidden"
                  name="acao"
                  value="cancelar"
                >
                <button
                  type="submit"
                  class="text-muted hover:text-default underline"
                >
                  cancelar
                </button>
              </form>

              <form
                v-if="mensalidade.situacao === 'CANCELADA'"
                method="post"
                :action="`/api/mensalidades/${mensalidade.id}/ajuste`"
              >
                <input
                  type="hidden"
                  name="acao"
                  value="reabrir"
                >
                <button
                  type="submit"
                  class="text-muted hover:text-default underline"
                >
                  reabrir
                </button>
              </form>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
