<script setup lang="ts">
const { public: config } = useRuntimeConfig()
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col">
      <main class="flex-1">
        <NuxtPage />
      </main>

      <footer class="border-t border-default py-6 text-center text-sm text-muted">
        <!-- Link exigido pelo artigo 13 da AGPL-3.0. Ver README. -->
        <ULink
          :to="config.sourceUrl"
          target="_blank"
          class="hover:text-default"
        >
          código-fonte
        </ULink>
      </footer>
    </div>
  </UApp>
</template>
