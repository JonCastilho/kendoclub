<script setup lang="ts">
import { competenciaAtual, formatarCompetencia } from '~~/shared/competencia'
import { formatarReais } from '~~/shared/dinheiro'
import { declaracaoPendente } from '~~/shared/declaracao'

definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Mensalidades - KendoClub' })

const rota = useRoute()

const { data } = await useFetch('/api/mensalidades', {
  query: computed(() => ({
    competencia: rota.query.competencia,
    situacao: rota.query.situacao,
  })),
})

// Quem receberia lembrete agora. Não depende da competência da tela: o atraso
// é de qualquer mês que continue em aberto.
const { data: lembretes } = await useFetch('/api/mensalidades/lembretes')

/** Resumo do envio, devolvido pelo endpoint na própria URL. */
const envio = computed(() => {
  if (rota.query.lembretesPessoas === undefined) return null
  return {
    pessoas: Number(rota.query.lembretesPessoas),
    mensalidades: Number(rota.query.lembretesMensalidades),
    semServidor: Number(rota.query.lembretesSemServidor),
    falhas: Number(rota.query.lembretesFalhas),
  }
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

/** Instante do envio, no relógio de quem lê: não é um dia de calendário. */
function diaDoEnvio(valor: string) {
  return new Date(valor).toLocaleDateString('pt-BR')
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

    <UAlert
      v-if="envio"
      class="mt-4"
      :color="envio.semServidor || envio.falhas ? 'warning' : 'success'"
      variant="subtle"
      title="Lembretes processados"
    >
      <template #description>
        {{ envio.pessoas }} e-mail(s) enviado(s), cobrindo {{ envio.mensalidades }}
        mensalidade(s).
        <template v-if="envio.semServidor">
          {{ envio.semServidor }} pessoa(s) deixaram de receber porque o clube
          ainda não configurou o servidor de e-mail; elas continuam na fila.
        </template>
        <template v-if="envio.falhas">
          {{ envio.falhas }} envio(s) falharam e serão tentados de novo.
        </template>
      </template>
    </UAlert>

    <UAlert
      v-if="data?.aConferir"
      class="mt-4"
      color="warning"
      variant="subtle"
      :title="`${data.aConferir} aviso(s) de pagamento a conferir`"
      description="Praticantes avisaram que pagaram. Confira o extrato e dê baixa, ou recuse dizendo por quê."
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

    <!-- Só mensalidade manda e-mail de atraso. O mesmo envio roda sozinho todo
         dia; o botão existe para a diretoria não esperar o horário. -->
    <section class="mt-6 rounded-md border border-default p-4">
      <h2 class="font-semibold">
        Lembretes de atraso
      </h2>
      <p class="mt-1 text-sm text-muted">
        Todo dia o sistema avisa por e-mail quem chegou a 15 e a 30 dias de
        atraso. O atraso conta do vencimento ou do dia de pagamento que a pessoa
        combinou, o que for mais tarde. Quem avisou que pagou e espera conferência
        não recebe.
      </p>

      <div
        v-if="lembretes?.pessoas"
        class="mt-3 text-sm"
      >
        Para enviar agora: <strong>{{ lembretes.pessoas }}</strong> pessoa(s),
        {{ lembretes.mensalidades }} mensalidade(s).
        <ul class="mt-1 text-muted">
          <li
            v-for="lembrete in lembretes.lembretes"
            :key="lembrete.praticanteId"
          >
            {{ lembrete.nome }} —
            {{ lembrete.itens.map(i => `${formatarCompetencia(i.competencia)} (${i.marco} dias)`).join(', ') }}
          </li>
        </ul>
      </div>
      <p
        v-else
        class="mt-3 text-sm text-muted"
      >
        Ninguém tem lembrete a enviar hoje.
      </p>

      <form
        method="post"
        action="/api/mensalidades/lembretes"
        class="mt-3"
      >
        <input
          type="hidden"
          name="competencia"
          :value="competencia"
        >
        <button
          type="submit"
          :disabled="!lembretes?.pessoas"
          class="rounded-md border border-default px-3 py-2 text-sm disabled:opacity-50"
        >
          Enviar lembretes agora
        </button>
      </form>
    </section>

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
              v-if="mensalidade.lembretes.length"
              class="mt-1 text-xs text-muted"
            >
              Lembrete enviado:
              {{ mensalidade.lembretes.map(l => `${l.dias} dias, em ${diaDoEnvio(l.enviadoEm)}`).join('; ') }}
            </p>

            <p
              v-if="mensalidade.situacao === 'PAGA'"
              class="mt-1 text-xs text-muted"
            >
              Pago em {{ data_(mensalidade.pagaEm) }}
              ({{ formatarReais(mensalidade.valorPago) }}),
              baixa por {{ mensalidade.baixadaPor?.email ?? '—' }}
            </p>

            <!-- O aviso do praticante aparece junto da cobrança, e não numa
                 caixa de entrada à parte: é aqui que a diretoria decide. -->
            <div
              v-if="declaracaoPendente(mensalidade.declaracoes)"
              class="mt-2 rounded-md border border-warning/50 bg-warning/10 p-2 text-sm"
            >
              <p>
                <strong>Avisou que pagou</strong> em
                {{ data_(declaracaoPendente(mensalidade.declaracoes)!.pagoEm) }}
                <span
                  v-if="declaracaoPendente(mensalidade.declaracoes)!.observacao"
                  class="text-muted"
                >— {{ declaracaoPendente(mensalidade.declaracoes)!.observacao }}</span>
              </p>
              <p class="text-xs text-muted mt-1">
                Dar baixa aceita o aviso. Se o pagamento não constar, recuse
                dizendo por quê.
              </p>

              <form
                method="post"
                :action="`/api/mensalidades/${mensalidade.id}/declaracao`"
                class="mt-2 flex gap-2 flex-wrap"
              >
                <input
                  type="hidden"
                  name="acao"
                  value="recusar"
                >
                <input
                  name="motivoRecusa"
                  aria-label="Motivo da recusa"
                  placeholder="Não encontrei no extrato"
                  required
                  class="flex-1 min-w-52 rounded-md border border-default bg-default px-2 py-1 text-sm"
                >
                <button
                  type="submit"
                  class="rounded-md border border-default px-3 py-1 text-sm"
                >
                  Recusar
                </button>
              </form>
            </div>
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
