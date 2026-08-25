<script setup lang="ts">
definePageMeta({ middleware: 'diretoria' })
useHead({ title: 'Configurações - KendoClub' })

const { data: clube } = await useFetch('/api/configuracoes')

const classeCampo = 'w-full rounded-md border border-default bg-default px-3 py-2'
</script>

<template>
  <div
    v-if="clube"
    class="max-w-2xl mx-auto px-4 py-10"
  >
    <AvisoErros />

    <h1 class="text-2xl font-bold">
      Configurações do clube
    </h1>
    <p class="mt-1 text-sm text-muted">
      Valores aqui valem para novas cobranças e novos aluguéis. O que já foi
      registrado guarda o valor da época.
    </p>

    <form
      method="post"
      action="/api/configuracoes"
      class="mt-6 flex flex-col gap-6"
    >
      <CampoTexto
        nome="nomeClube"
        rotulo="Nome do clube"
        obrigatorio
        :valor="clube.nomeClube"
      />

      <div class="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          nome="valorMensalidade"
          rotulo="Mensalidade"
          :valor="String(clube.valorMensalidade)"
          ajuda="Mesmo valor para todos."
        />
        <CampoTexto
          nome="valorAluguelPadrao"
          rotulo="Aluguel de bogu"
          :valor="String(clube.valorAluguelPadrao)"
          ajuda="Sugerido ao registrar aluguel sem item."
        />
        <div>
          <label
            for="diaVencimento"
            class="block text-sm font-medium mb-1"
          >Dia do vencimento</label>
          <input
            id="diaVencimento"
            type="number"
            name="diaVencimento"
            min="1"
            max="31"
            :value="clube.diaVencimento"
            :class="classeCampo"
          >
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          nome="chavePix"
          rotulo="Chave Pix"
          :valor="clube.chavePix"
          ajuda="Aparece para o praticante pagar a mensalidade."
        />
        <CampoTexto
          nome="titularPix"
          rotulo="Titular da chave"
          :valor="clube.titularPix"
        />
        <CampoTexto
          nome="emailContato"
          rotulo="E-mail de contato"
          tipo="email"
          :valor="clube.emailContato"
        />
      </div>

      <div>
        <button
          type="submit"
          class="rounded-md bg-primary text-inverted font-medium px-4 py-2"
        >
          Salvar
        </button>
      </div>
    </form>
  </div>
</template>
