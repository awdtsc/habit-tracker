// resources/js/app.js

import './bootstrap'
import Alpine from 'alpinejs'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import axios from 'axios'

import { waitForBackendAlive, renderOfflineScreen } from './startup/offline'
import { fetchCsrfCookie, setupAxiosInterceptor } from './startup/backend'

// Alpine init
window.Alpine = Alpine
Alpine.start()

// Sanctum cookie
axios.defaults.withCredentials = true

;(async () => {

  /* ---------------------------------------------
   * 0. Axios interceptor（401 → event）
   * ------------------------------------------- */
  setupAxiosInterceptor()

  const IS_LOGIN = window.location.pathname.startsWith('/login')

  /* ---------------------------------------------
   * 1. Backend 生存確認
   * ------------------------------------------- */
  if (!await waitForBackendAlive()) {
    return renderOfflineScreen()
  }

  /* ---------------------------------------------
   * 2. CSRF Cookie
   * ------------------------------------------- */
  if (!await fetchCsrfCookie()) {
    return renderOfflineScreen()
  }

  /* ---------------------------------------------
   * 3. SPA root
   * ------------------------------------------- */
  const el = document.getElementById('app')
  if (!el) return

  /* ---------------------------------------------
   * 4. Vue / Pinia
   * ------------------------------------------- */
  const app   = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  /* ---------------------------------------------
   * 5. Stores
   * ------------------------------------------- */
  const { useAuthStore }        = await import('./stores/auth')
  const { useHabitBoardStore }  = await import('./stores/habitBoard/store')

  const auth  = useAuthStore()
  const board = useHabitBoardStore()

  // Debug
  if (typeof window !== 'undefined') {
    window.__auth  = auth
    window.__board = board
    window.useAuthStore = useAuthStore
    window.useHabitBoardStore = useHabitBoardStore
  }

  /* ---------------------------------------------
   * 6. restore()（認証状態確定）
   * ------------------------------------------- */
  try {
    await auth.restore()
    console.log('[startup] auth.restore done')
  } catch (err) {
    console.warn('[startup] restore failed', err)
  }

  /* ---------------------------------------------
   * 7. Auth Guards（restore 後）
   * ------------------------------------------- */
  const { injectAuthStore, setupAuthGuards } =
    await import('./startup/auth-guards')

  injectAuthStore(auth)
  setupAuthGuards(router)

  /* ---------------------------------------------
   * 8. mount
   * ------------------------------------------- */
  app.use(router)
  await router.isReady()
  app.mount(el)
  console.log('[APP] mounted')

  /* ---------------------------------------------
   * 9. Remind / Push
   * ------------------------------------------- */
  const { setupRemindSystem } = await import('./startup/remind')
  const { registerSwAndPush } = await import('./startup/push')

  setupRemindSystem()
  await registerSwAndPush(IS_LOGIN)

})()
