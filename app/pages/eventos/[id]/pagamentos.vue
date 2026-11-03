<script setup lang="ts">
import {
  type LinhaDePagamento,
  ROTULO_DO_ESTADO,
  type ResumoDePagamentos,
  estadoDoPagamento,
} from '~~/shared/cobrancaEvento'
import { formatarReais } from '~~/shared/dinheiro'

definePageMeta({ middleware: 'diretoria' })

interface DadosDaTela {
  evento: { id: string, titulo: string, slug: string }
  resumo: ResumoDePagamentos
  linhas: LinhaDePagamento[]
}

const id = useRoute().params.id as string
const { data } = await useFetch<DadosDaTela>(`/api/eventos/${id}/pagamentos`)

useHead({ title: () => `Pagamentos de ${data.value?.evento.titulo ?? ''} - KendoClub` })

const classeCampo = 'rounded-md border border-default bg-default px-2 py-1 text-sm'
const classeBotao = 'rounded-md border border-default px-3 py-1 text-sm'

const CORES = {
  EM_ANALISE: 'info',
  GERADA: 'neutral',
  DESATUALIZADA: 'warning',
  SEM_PIX: 'neutral',
  PAGA: 'success',
  GRATUITA: 'neutral',
} as const
</script>

<template>
  <div
    v-if="data"
    class="max-w-5xl mx-auto px-4 py-10"
  >
    <h1 class="text-2xl font-bold">
      Pagamentos
    </h1>
    <p class="text-muted">
      {{ data.evento.titulo }}
    </p>

    <p class="mt-4 max-w-3xl text-sm text-muted">
      Comprovantes para conferir vêm primeiro. <strong>Confirmar</strong> dá a baixa e
      <strong>recusar</strong> devolve a cobrança à pessoa, com o motivo; nos dois casos o
      arquivo do comprovante é apagado. <strong>Dar baixa</strong> serve ao pagamento feito
      fora do sistema.
    </p>

    <div class="mt-6 grid gap-4 sm:grid-cols-3">
      <UCard>
        <div class="text-sm text-muted">
          Confirmado
        </div>
        <div class="text-3xl font-bold">
          {{ formatarReais(data.resumo.confirmado) }}
        </div>
        <div class="text-sm text-muted">
          de {{ formatarReais(data.resumo.esperado) }} esperados
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-muted">
          Para conferir
        </div>
        <div class="text-3xl font-bold">
          {{ data.resumo.porEstado.EM_ANALISE }}
        </div>
        <div class="text-sm text-muted">
          comprovante(s) em análise
        </div>
      </UCard>

      <UCard>
        <div class="text-sm text-muted">
          Ainda sem pagamento
        </div>
        <div class="text-3xl font-bold">
          {{ data.resumo.porEstado.GERADA + data.resumo.porEstado.DESATUALIZADA + data.resumo.porEstado.SEM_PIX }}
        </div>
        <div class="text-sm text-muted">
          {{ data.resumo.porEstado.SEM_PIX }} sem Pix · {{ data.resumo.porEstado.DESATUALIZADA }} desatualizado(s)
        </div>
      </UCard>
    </div>

    <p
      v-if="!data.linhas.length"
      class="mt-8 text-muted"
    >
      Ainda não há inscritos.
    </p>

    <div
      v-else
      class="mt-6 overflow-x-auto"
    >
      <table class="w-full text-sm">
        <caption class="sr-only">
          Pagamentos dos inscritos
        </caption>
        <thead class="text-left text-muted">
          <tr>
            <th
              scope="col"
              class="py-2 pr-4 font-medium"
            >
              Nome
            </th>
            <th
              scope="col"
              class="py-2 pr-4 font-medium"
            >
              Valor
            </th>
            <th
              scope="col"
              class="py-2 pr-4 font-medium"
            >
              Situação
            </th>
            <th
              scope="col"
              class="py-2 font-medium"
            >
              O que fazer
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="linha in data.linhas"
            :key="linha.praticanteId"
            class="border-t border-default align-top"
          >
            <th
              scope="row"
              class="py-3 pr-4 text-left font-normal"
            >
              <ULink :to="`/agenda/${data.evento.slug}?praticante=${linha.praticanteId}`">
                {{ linha.nome }}
              </ULink>
              <div
                v-if="!linha.filiado"
                class="text-xs text-muted"
              >
                não filiado
              </div>
            </th>

            <td class="py-3 pr-4 whitespace-nowrap">
              {{ formatarReais(linha.cobranca?.valor ?? linha.total) }}
              <div
                v-if="linha.cobranca && linha.cobranca.valor !== linha.total"
                class="text-xs text-warning"
              >
                hoje: {{ formatarReais(linha.total) }}
              </div>
            </td>

            <td class="py-3 pr-4">
              <UBadge
                :color="CORES[estadoDoPagamento(linha)]"
                variant="subtle"
              >
                {{ ROTULO_DO_ESTADO[estadoDoPagamento(linha)] }}
              </UBadge>
              <div
                v-if="linha.cobranca?.motivoRecusa && linha.cobranca.situacao === 'GERADA'"
                class="mt-1 text-xs text-muted"
              >
                recusado: {{ linha.cobranca.motivoRecusa }}
              </div>
              <div
                v-if="linha.cobranca?.observacao"
                class="mt-1 text-xs text-muted"
              >
                {{ linha.cobranca.observacao }}
              </div>
            </td>

            <td class="py-3">
              <!-- Em análise: ver o comprovante e decidir. -->
              <div
                v-if="estadoDoPagamento(linha) === 'EM_ANALISE'"
                class="flex flex-col gap-2"
              >
                <a
                  v-if="linha.cobranca!.temComprovante"
                  :href="`/api/eventos/comprovante/${linha.cobranca!.id}`"
                  target="_blank"
                  rel="noopener"
                  class="underline"
                >Ver o comprovante</a>
                <span
                  v-else
                  class="text-warning"
                >Comprovante indisponível: recuse para a pessoa enviar outro.</span>

                <form
                  method="post"
                  action="/api/eventos/pagamento"
                >
                  <input
                    type="hidden"
                    name="cobrancaId"
                    :value="linha.cobranca!.id"
                  >
                  <input
                    type="hidden"
                    name="acao"
                    value="aceitar"
                  >
                  <button
                    type="submit"
                    :class="classeBotao"
                  >
                    Confirmar pagamento
                  </button>
                </form>

                <form
                  method="post"
                  action="/api/eventos/pagamento"
                  class="flex flex-wrap items-center gap-2"
                >
                  <input
                    type="hidden"
                    name="cobrancaId"
                    :value="linha.cobranca!.id"
                  >
                  <input
                    type="hidden"
                    name="acao"
                    value="recusar"
                  >
                  <input
                    name="motivoRecusa"
                    required
                    maxlength="200"
                    placeholder="Por que não confere"
                    :aria-label="`Motivo da recusa do comprovante de ${linha.nome}`"
                    :class="`${classeCampo} w-56`"
                  >
                  <button
                    type="submit"
                    :class="classeBotao"
                  >
                    Recusar
                  </button>
                </form>
              </div>

              <!-- Pix gerado e em dia: pagamento feito fora do sistema. -->
              <form
                v-else-if="estadoDoPagamento(linha) === 'GERADA'"
                method="post"
                action="/api/eventos/pagamento"
              >
                <input
                  type="hidden"
                  name="cobrancaId"
                  :value="linha.cobranca!.id"
                >
                <input
                  type="hidden"
                  name="acao"
                  value="baixar"
                >
                <button
                  type="submit"
                  :class="classeBotao"
                >
                  Dar baixa (pago fora do sistema)
                </button>
              </form>

              <span
                v-else-if="estadoDoPagamento(linha) === 'DESATUALIZADA'"
                class="text-muted"
              >
                A inscrição mudou depois do Pix: abra a inscrição e gere um novo.
              </span>

              <span
                v-else-if="estadoDoPagamento(linha) === 'SEM_PIX'"
                class="text-muted"
              >
                A pessoa ainda não gerou o Pix. Abra a inscrição para gerar por ela.
              </span>

              <!-- Pago: o estorno desfaz uma baixa errada, e fica registrado. -->
              <form
                v-else-if="estadoDoPagamento(linha) === 'PAGA'"
                method="post"
                action="/api/eventos/pagamento"
                class="flex flex-wrap items-center gap-2"
              >
                <input
                  type="hidden"
                  name="cobrancaId"
                  :value="linha.cobranca!.id"
                >
                <input
                  type="hidden"
                  name="acao"
                  value="estornar"
                >
                <label class="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    required
                  >
                  confirmo
                </label>
                <button
                  type="submit"
                  :class="classeBotao"
                >
                  Estornar baixa
                </button>
              </form>

              <span
                v-else
                class="text-muted"
              >—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-8 flex gap-4 text-sm">
      <ULink :to="`/eventos/${data.evento.id}`">
        Editar evento
      </ULink>
      <ULink :to="`/eventos/${data.evento.id}/inscritos`">
        Inscritos
      </ULink>
    </div>
  </div>
</template>
