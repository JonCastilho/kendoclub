<script setup lang="ts">
import { grausDaModalidade, rotuloDoGrau } from '~~/shared/graduacao'

definePageMeta({ middleware: 'diretoria' })

const rota = useRoute()
const id = rota.params.id as string

const { data: praticante } = await useFetch(`/api/praticantes/${id}`)
const { data: modalidades } = await useFetch('/api/modalidades')

useHead({ title: () => `${praticante.value?.nomeCompleto ?? 'Praticante'} - KendoClub` })

const hoje = new Date().toISOString().slice(0, 10)

function data(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/** Modalidades ainda não vinculadas, para não oferecer repetição. */
const disponiveis = computed(() => {
  const jaTem = new Set(praticante.value?.modalidadesComGraduacao.map(m => m.modalidadeId))
  return (modalidades.value ?? []).filter(m => m.ativa && !jaTem.has(m.id))
})

const classeCampo = 'rounded-md border border-default bg-default px-3 py-2'
const classeBotao = 'rounded-md border border-default px-3 py-2 text-sm'
</script>

<template>
  <div
    v-if="praticante"
    class="max-w-4xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          {{ praticante.nomeCompleto }}
        </h1>
        <div class="mt-1 flex items-center gap-2 text-sm text-muted">
          <UBadge
            :color="praticante.filiado ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ praticante.filiado ? 'Filiado' : 'Desligado' }}
          </UBadge>
          <span>no clube desde {{ data(praticante.noClubeDesde) }}</span>
        </div>
      </div>
      <ULink
        :to="`/praticantes/${id}/editar`"
        class="rounded-md border border-default px-4 py-2"
      >
        Editar dados
      </ULink>
    </div>

    <UCard class="mt-6">
      <dl class="grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <dt class="text-muted">
            Nascimento
          </dt>
          <dd>{{ data(praticante.dataNascimento) }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Documento
          </dt>
          <dd>
            {{ praticante.documento }}
            <span
              v-if="praticante.titularDocumento === 'RESPONSAVEL'"
              class="text-muted"
            >(do responsável)</span>
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            Nacionalidade
          </dt>
          <dd>{{ praticante.nacionalidade }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            E-mail
          </dt>
          <dd>{{ praticante.email }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Telefone
          </dt>
          <dd>{{ praticante.telefone }}</dd>
        </div>
        <div>
          <dt class="text-muted">
            Emergência
          </dt>
          <dd>
            {{ praticante.emergenciaNome || '—' }}
            <span v-if="praticante.emergenciaTelefone">· {{ praticante.emergenciaTelefone }}</span>
          </dd>
        </div>
      </dl>
    </UCard>

    <!-- Dado sensível: aparece só aqui, para a diretoria, e nunca em listagem. -->
    <UAlert
      v-if="praticante.observacoesMedicas"
      class="mt-4"
      color="warning"
      variant="subtle"
      title="Observações médicas"
      :description="praticante.observacoesMedicas"
    />

    <section class="mt-10">
      <h2 class="font-semibold mb-3">
        Filiações
      </h2>

      <ul class="text-sm divide-y divide-default border-y border-default">
        <li
          v-for="filiacao in praticante.filiacoes"
          :key="filiacao.id"
          class="py-2 flex items-center justify-between gap-4 flex-wrap"
        >
          <span>
            {{ data(filiacao.inicioEm) }} até
            {{ filiacao.fimEm ? data(filiacao.fimEm) : 'hoje' }}
            <span
              v-if="filiacao.motivoSaida"
              class="text-muted"
            >· {{ filiacao.motivoSaida }}</span>
          </span>

          <form
            v-if="!filiacao.fimEm"
            method="post"
            :action="`/api/praticantes/${id}/filiacoes`"
            class="flex gap-2 flex-wrap"
          >
            <input
              type="hidden"
              name="acao"
              value="encerrar"
            >
            <input
              type="hidden"
              name="filiacaoId"
              :value="filiacao.id"
            >
            <input
              type="date"
              name="fimEm"
              :value="hoje"
              required
              :class="classeCampo"
            >
            <input
              name="motivoSaida"
              placeholder="Motivo da saída"
              :class="classeCampo"
            >
            <button
              type="submit"
              :class="classeBotao"
            >
              Encerrar
            </button>
          </form>
        </li>
      </ul>

      <form
        v-if="!praticante.filiado"
        method="post"
        :action="`/api/praticantes/${id}/filiacoes`"
        class="mt-3 flex gap-2 flex-wrap"
      >
        <input
          type="date"
          name="inicioEm"
          :value="hoje"
          required
          :class="classeCampo"
        >
        <button
          type="submit"
          :class="classeBotao"
        >
          Refiliar
        </button>
      </form>
    </section>

    <section class="mt-10">
      <h2 class="font-semibold mb-3">
        Modalidades e graduações
      </h2>

      <div
        v-for="modalidade in praticante.modalidadesComGraduacao"
        :key="modalidade.modalidadeId"
        class="mb-4 border border-default rounded-md p-4"
      >
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <span class="font-medium">{{ modalidade.modalidade }}</span>
            <span class="ml-2 text-sm text-muted">
              {{ modalidade.graduacaoAtual ? rotuloDoGrau(modalidade.graduacaoAtual) : 'sem graduação' }}
              · desde {{ data(modalidade.desde) }}
            </span>
          </div>
        </div>

        <ul class="mt-3 text-sm text-muted">
          <li
            v-for="graduacao in praticante.graduacoes.filter(g => g.modalidadeId === modalidade.modalidadeId)"
            :key="graduacao.id"
          >
            {{ rotuloDoGrau(graduacao.grau) }} em {{ data(graduacao.obtidaEm) }}
          </li>
        </ul>

        <form
          method="post"
          :action="`/api/praticantes/${id}/graduacoes`"
          class="mt-3 flex gap-2 flex-wrap"
        >
          <input
            type="hidden"
            name="modalidadeId"
            :value="modalidade.modalidadeId"
          >
          <select
            name="grau"
            required
            :class="classeCampo"
          >
            <option
              v-for="grau in grausDaModalidade(modalidade.kyuInicial)"
              :key="grau"
              :value="grau"
            >
              {{ rotuloDoGrau(grau) }}
            </option>
          </select>
          <input
            type="date"
            name="obtidaEm"
            :value="hoje"
            required
            :class="classeCampo"
          >
          <button
            type="submit"
            :class="classeBotao"
          >
            Registrar graduação
          </button>
        </form>
      </div>

      <form
        v-if="disponiveis.length"
        method="post"
        :action="`/api/praticantes/${id}/modalidades`"
        class="flex gap-2 flex-wrap"
      >
        <select
          name="modalidadeId"
          required
          :class="classeCampo"
        >
          <option
            v-for="modalidade in disponiveis"
            :key="modalidade.id"
            :value="modalidade.id"
          >
            {{ modalidade.nome }}
          </option>
        </select>
        <input
          type="date"
          name="desde"
          :value="hoje"
          :class="classeCampo"
        >
        <button
          type="submit"
          :class="classeBotao"
        >
          Adicionar modalidade
        </button>
      </form>
    </section>

    <section class="mt-10 mb-16">
      <h2 class="font-semibold mb-3">
        Isenção de mensalidade
      </h2>

      <ul
        v-if="praticante.isencoes.length"
        class="text-sm divide-y divide-default border-y border-default mb-3"
      >
        <li
          v-for="isencao in praticante.isencoes"
          :key="isencao.id"
          class="py-2 flex items-center justify-between gap-4 flex-wrap"
        >
          <span>
            {{ data(isencao.inicioEm) }} até {{ isencao.fimEm ? data(isencao.fimEm) : 'hoje' }}
            · {{ isencao.motivo }}
          </span>
          <form
            v-if="!isencao.fimEm"
            method="post"
            :action="`/api/praticantes/${id}/isencoes`"
          >
            <input
              type="hidden"
              name="acao"
              value="encerrar"
            >
            <input
              type="hidden"
              name="isencaoId"
              :value="isencao.id"
            >
            <button
              type="submit"
              :class="classeBotao"
            >
              Encerrar
            </button>
          </form>
        </li>
      </ul>

      <form
        v-if="!praticante.isencaoVigente"
        method="post"
        :action="`/api/praticantes/${id}/isencoes`"
        class="flex gap-2 flex-wrap"
      >
        <input
          type="date"
          name="inicioEm"
          :value="hoje"
          required
          :class="classeCampo"
        >
        <input
          name="motivo"
          placeholder="Motivo da isenção"
          required
          class="flex-1 min-w-60 rounded-md border border-default bg-default px-3 py-2"
        >
        <button
          type="submit"
          :class="classeBotao"
        >
          Conceder isenção
        </button>
      </form>
    </section>
  </div>
</template>
