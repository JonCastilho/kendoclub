<script setup lang="ts">
import {
  type ColunaCbk,
  type LinhaCbk,
  POSICOES,
  ROTULO_DA_POSICAO,
  type ResumoDaCompeticao,
  TAMANHO_MAXIMO_DO_ZEKKEN,
} from '~~/shared/cbk'
import { formatarDia } from '~~/shared/evento'

definePageMeta({ middleware: 'diretoria' })

interface DadosDaTela {
  evento: { id: string, titulo: string, slug: string, prazo: string, inscricoesAbertas: boolean }
  colunas: ColunaCbk[]
  linhas: LinhaCbk[]
  resumo: ResumoDaCompeticao[]
}

const id = useRoute().params.id as string
const { data } = await useFetch<DadosDaTela>(`/api/eventos/${id}/cbk`)

useHead({ title: () => `Dados para a CBK - ${data.value?.evento.titulo ?? ''} - KendoClub` })

const classeCampo = 'rounded-md border border-default bg-default px-2 py-1 text-sm'

function fichaDe(linha: LinhaCbk, coluna: ColunaCbk) {
  return linha.fichas.find(f => f.subeventoId === coluna.subeventoId)
}
</script>

<template>
  <div
    v-if="data"
    class="px-4 py-10 max-w-full"
  >
    <h1 class="text-2xl font-bold">
      Dados para a CBK
    </h1>
    <p class="text-muted">
      {{ data.evento.titulo }}
    </p>

    <p class="mt-4 max-w-3xl text-sm text-muted">
      Os dados das inscrições, na ordem da planilha. O nome no zekken/nafuda e a
      posição na primeira luta são preenchidos aqui, pela diretoria. <strong>Avulso</strong>
      é para quem compete por equipes mas não tem integrantes para formar um time.
    </p>

    <p
      v-if="data.evento.inscricoesAbertas"
      class="mt-3 text-sm text-warning"
    >
      As inscrições ainda estão abertas, até {{ formatarDia(data.evento.prazo) }}:
      estes dados podem mudar.
    </p>

    <ul
      v-if="data.resumo.length"
      class="mt-4 text-sm"
    >
      <li
        v-for="competicao in data.resumo"
        :key="competicao.subeventoId"
      >
        <strong>{{ competicao.rotulo }}:</strong>
        {{ competicao.individuais }} no individual · {{ competicao.equipes }} por equipes
        <template v-if="competicao.equipes">
          ({{ competicao.avulsos }} avulso(s))
        </template>
      </li>
    </ul>

    <p
      v-if="!data.linhas.length"
      class="mt-8 text-muted"
    >
      Ainda não há inscritos.
    </p>

    <form
      v-else
      method="post"
      action="/api/eventos/cbk"
      class="mt-6"
    >
      <input
        type="hidden"
        name="eventoId"
        :value="data.evento.id"
      >

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-muted">
            <tr>
              <th
                v-for="(coluna, indice) in [{ chave: 'nome', rotulo: 'Nome completo' }, ...data.colunas]"
                :key="coluna.chave"
                class="py-2 pr-4 align-bottom font-medium"
                :class="indice === 0 ? 'sticky left-0 bg-default' : 'min-w-28'"
              >
                {{ coluna.rotulo }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="linha in data.linhas"
              :key="linha.praticanteId"
              class="border-t border-default"
            >
              <td class="py-2 pr-4 sticky left-0 bg-default whitespace-nowrap">
                {{ linha.nome }}
              </td>
              <td
                v-for="coluna in data.colunas"
                :key="coluna.chave"
                class="py-2 pr-4"
              >
                <template v-if="coluna.tipo === 'ZEKKEN'">
                  <input
                    v-if="fichaDe(linha, coluna)"
                    :name="`zekken_${fichaDe(linha, coluna)!.inscricaoSubeventoId}`"
                    :value="fichaDe(linha, coluna)!.nomeNoZekken ?? ''"
                    :maxlength="TAMANHO_MAXIMO_DO_ZEKKEN"
                    :aria-label="`Nome no zekken de ${linha.nome}`"
                    :class="`${classeCampo} w-44`"
                  >
                  <template v-else>
                    —
                  </template>
                </template>

                <template v-else-if="coluna.tipo === 'POSICAO'">
                  <select
                    v-if="fichaDe(linha, coluna)?.naEquipe"
                    :name="`posicao_${fichaDe(linha, coluna)!.inscricaoSubeventoId}`"
                    :aria-label="`Posição na primeira luta de ${linha.nome}`"
                    :class="classeCampo"
                  >
                    <option
                      value=""
                      :selected="!fichaDe(linha, coluna)!.posicao"
                    >
                      definir
                    </option>
                    <option
                      v-for="posicao in POSICOES"
                      :key="posicao"
                      :value="posicao"
                      :selected="fichaDe(linha, coluna)!.posicao === posicao"
                    >
                      {{ ROTULO_DA_POSICAO[posicao] }}
                    </option>
                  </select>
                  <template v-else>
                    N
                  </template>
                </template>

                <template v-else>
                  {{ linha.celulas[coluna.chave] }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        class="mt-6 rounded-md bg-primary text-inverted font-medium px-4 py-2"
      >
        Salvar nome no zekken e posições
      </button>
    </form>

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
