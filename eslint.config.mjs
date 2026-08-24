// @ts-check
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

// Configuração direta, sem o módulo @nuxt/eslint: as ferramentas dele exigem
// Node 21+ (usam Object.groupBy) e o projeto roda em Node 20 — ver PLANO.md §7.
export default tseslint.config(
  {
    ignores: ['.nuxt/**', '.output/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    rules: {
      // Nuxt gera globais (useHead, defineNuxtConfig, ...) que o ESLint não
      // conhece; a checagem de identificador não declarado fica com o TypeScript.
      'no-undef': 'off',
      // Páginas de rota se chamam index.vue, [id].vue e afins por definição.
      'vue/multi-word-component-names': 'off',
    },
  },
)
