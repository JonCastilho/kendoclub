<script setup lang="ts">
import { COMPRIMENTO_MINIMO } from '~~/shared/senha'

useHead({ title: 'Redefinir senha - KendoClub' })

const rota = useRoute()
const token = computed(() => String(rota.query.t ?? ''))

const MENSAGENS: Record<string, string> = {
  dados: 'Preencha os dois campos de senha.',
  confirmacao: 'As duas senhas não são iguais.',
  fraca: `A senha precisa ter pelo menos ${COMPRIMENTO_MINIMO} caracteres e não pode ser previsível.`,
}

const erro = computed(() => {
  const chave = String(rota.query.erro ?? '')
  return chave ? (MENSAGENS[chave] ?? MENSAGENS.dados) : null
})
</script>

<template>
  <div class="max-w-sm mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold">
      Escolher nova senha
    </h1>

    <UAlert
      v-if="!token"
      class="mt-4"
      color="error"
      variant="subtle"
      title="Link incompleto"
      description="Abra o link exatamente como veio no e-mail."
    />

    <template v-else>
      <UAlert
        v-if="erro"
        class="mt-4"
        color="error"
        variant="subtle"
        :description="erro"
      />

      <form
        method="post"
        action="/api/auth/redefinir-senha"
        class="mt-6 flex flex-col gap-4"
      >
        <input
          type="hidden"
          name="token"
          :value="token"
        >

        <div>
          <label
            for="senha"
            class="block text-sm font-medium mb-1"
          >Nova senha</label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            :minlength="COMPRIMENTO_MINIMO"
            autocomplete="new-password"
            autofocus
            class="w-full rounded-md border border-default bg-default px-3 py-2"
          >
          <p class="mt-1 text-xs text-muted">
            Pelo menos {{ COMPRIMENTO_MINIMO }} caracteres. Prefira uma frase que
            só você diria a repetir letra e número.
          </p>
        </div>

        <div>
          <label
            for="confirmacao"
            class="block text-sm font-medium mb-1"
          >Repita a nova senha</label>
          <input
            id="confirmacao"
            name="confirmacao"
            type="password"
            required
            :minlength="COMPRIMENTO_MINIMO"
            autocomplete="new-password"
            class="w-full rounded-md border border-default bg-default px-3 py-2"
          >
        </div>

        <button
          type="submit"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2 hover:opacity-90"
        >
          Salvar nova senha
        </button>
      </form>
    </template>
  </div>
</template>
