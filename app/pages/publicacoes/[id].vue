<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })

import type { PublicacaoDetalhada } from '~~/shared/publicacao'

const id = useRoute().params.id as string

// A tela de edição encontra a publicação pelo id; o mesmo endpoint aceita id ou
// endereço público.
const { data: publicacao } = await useFetch<PublicacaoDetalhada>(`/api/publicacoes/${id}`)

useHead({ title: () => `Editar ${publicacao.value?.titulo ?? ''} - KendoClub` })

function data_(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div
    v-if="publicacao"
    class="max-w-3xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold">
          {{ publicacao.titulo }}
        </h1>
        <div class="mt-1 flex items-center gap-2 text-sm text-muted">
          <UBadge
            :color="publicacao.publicadaEm ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ publicacao.publicadaEm ? `publicada em ${data_(publicacao.publicadaEm)}` : 'rascunho' }}
          </UBadge>
          <span>/noticias/{{ publicacao.slug }}</span>
        </div>
      </div>

      <!-- Publicar e despublicar são ações próprias, separadas de salvar o
           texto: corrigir uma vírgula não deve tirar a notícia do ar. -->
      <form
        method="post"
        action="/api/publicacoes/publicar"
      >
        <input
          type="hidden"
          name="id"
          :value="publicacao.id"
        >
        <input
          v-if="publicacao.publicadaEm"
          type="hidden"
          name="acao"
          value="despublicar"
        >
        <button
          type="submit"
          class="rounded-md border border-default px-4 py-2"
        >
          {{ publicacao.publicadaEm ? 'Voltar a rascunho' : 'Publicar' }}
        </button>
      </form>
    </div>

    <form
      method="post"
      action="/api/publicacoes"
      class="mt-8 flex flex-col gap-4"
    >
      <input
        type="hidden"
        name="id"
        :value="publicacao.id"
      >

      <CampoTexto
        nome="titulo"
        rotulo="Título"
        obrigatorio
        :valor="publicacao.titulo"
        ajuda="O endereço da notícia não muda ao corrigir o título — links já compartilhados continuam valendo."
      />

      <div>
        <label
          for="conteudo"
          class="block text-sm font-medium mb-1"
        >Conteúdo</label>
        <textarea
          id="conteudo"
          name="conteudo"
          rows="12"
          required
          :class="classeCampo"
          :value="publicacao.conteudo"
        />
      </div>

      <div>
        <label
          for="visibilidade"
          class="block text-sm font-medium mb-1"
        >Quem pode ver</label>
        <select
          id="visibilidade"
          name="visibilidade"
          :class="classeCampo"
        >
          <option
            value="PUBLICA"
            :selected="publicacao.visibilidade === 'PUBLICA'"
          >
            Qualquer pessoa, inclusive quem não é do clube
          </option>
          <option
            value="RESTRITA"
            :selected="publicacao.visibilidade === 'RESTRITA'"
          >
            Só praticantes com acesso ao sistema
          </option>
        </select>
      </div>

      <div class="flex gap-3">
        <button
          type="submit"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
        >
          Salvar
        </button>
        <ULink
          to="/publicacoes"
          class="px-4 py-2"
        >
          Voltar
        </ULink>
      </div>
    </form>
  </div>
</template>
