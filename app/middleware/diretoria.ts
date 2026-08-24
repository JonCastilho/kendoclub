/**
 * Área da diretoria. Praticante autenticado que tentar entrar vai para a área
 * dele, sem mensagem de erro: não é falha, é lugar errado.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo(`/entrar?destino=${encodeURIComponent(to.fullPath)}`)
  }

  if (user.value?.papel !== 'DIRETORIA') {
    return navigateTo('/minha-area')
  }
})
