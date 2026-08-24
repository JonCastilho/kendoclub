/**
 * Barra quem não entrou e guarda para onde ia, para não perder o caminho depois
 * do login. Isto é conveniência de navegação — o controle de acesso de verdade
 * está em cada rota do servidor.
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo(`/entrar?destino=${encodeURIComponent(to.fullPath)}`)
  }
})
