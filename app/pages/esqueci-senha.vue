<script setup lang="ts">
useHead({ title: 'Esqueci minha senha - KendoClub' })

const rota = useRoute()
const enviado = computed(() => rota.query.enviado === '1')
const expirado = computed(() => rota.query.erro === 'expirado')
</script>

<template>
  <div class="max-w-sm mx-auto px-4 py-16">
    <h1 class="text-2xl font-bold">
      Esqueci minha senha
    </h1>

    <UAlert
      v-if="expirado"
      class="mt-4"
      color="warning"
      variant="subtle"
      title="Link inválido ou vencido"
      description="Peça um novo link abaixo."
    />

    <!--
      A confirmação não diz se o e-mail existe. Se dissesse, qualquer pessoa
      poderia descobrir quem tem cadastro no clube testando endereços.
    -->
    <UAlert
      v-if="enviado"
      class="mt-4"
      color="success"
      variant="subtle"
      title="Pedido registrado"
      description="Se houver uma conta com esse e-mail, o link de redefinição chegou na caixa de entrada. Ele vale por uma hora."
    />

    <form
      v-else
      method="post"
      action="/api/auth/esqueci-senha"
      class="mt-6 flex flex-col gap-4"
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

      <button
        type="submit"
        class="rounded-md bg-primary text-inverted font-medium px-4 py-2 hover:opacity-90"
      >
        Enviar link
      </button>
    </form>

    <p class="mt-4 text-sm">
      <ULink to="/entrar">
        Voltar para o login
      </ULink>
    </p>
  </div>
</template>
