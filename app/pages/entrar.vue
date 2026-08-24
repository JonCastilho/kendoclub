<script setup lang="ts">
useHead({ title: 'Entrar - KendoClub' })

const rota = useRoute()

const MENSAGENS: Record<string, string> = {
  dados: 'Preencha o e-mail e a senha.',
  credenciais: 'E-mail ou senha incorretos.',
  bloqueado: 'Tentativas demais. Espere quinze minutos e tente de novo.',
  inativo: 'Esta conta está desativada. Fale com a diretoria.',
}

const erro = computed(() => {
  const chave = String(rota.query.erro ?? '')
  return chave ? (MENSAGENS[chave] ?? MENSAGENS.credenciais) : null
})

const redefinida = computed(() => rota.query.redefinida === '1')
const destino = computed(() => String(rota.query.destino ?? ''))
</script>

<template>
  <div class="max-w-sm mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold">
      Entrar
    </h1>

    <UAlert
      v-if="redefinida"
      class="mt-4"
      color="success"
      variant="subtle"
      title="Senha redefinida"
      description="Use a nova senha para entrar."
    />

    <UAlert
      v-if="erro"
      class="mt-4"
      color="error"
      variant="subtle"
      :description="erro"
    />

    <!--
      Formulário nativo, com method e action explícitos: funciona antes da
      hidratação e mesmo sem JavaScript. É o que evita o envio por GET descrito
      no aviso GHSA-gj2h-2fpw-fhv9 do Nuxt UI, que mandaria a senha na URL.
    -->
    <form
      method="post"
      action="/api/auth/entrar"
      class="mt-6 flex flex-col gap-4"
    >
      <input
        v-if="destino"
        type="hidden"
        name="destino"
        :value="destino"
      >

      <div>
        <label
          for="email"
          class="block text-sm font-medium mb-1"
        >E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="email"
          autofocus
          class="w-full rounded-md border border-default bg-default px-3 py-2"
        >
      </div>

      <div>
        <label
          for="senha"
          class="block text-sm font-medium mb-1"
        >Senha</label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autocomplete="current-password"
          class="w-full rounded-md border border-default bg-default px-3 py-2"
        >
      </div>

      <button
        type="submit"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2 hover:opacity-90"
      >
        Entrar
      </button>
    </form>

    <p class="mt-4 text-sm">
      <ULink to="/esqueci-senha">
        Esqueci minha senha
      </ULink>
    </p>
  </div>
</template>
