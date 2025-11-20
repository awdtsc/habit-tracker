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

// Alpine
window.Alpine = Alpine
Alpine.start()

// Sanctum cookie
axios.defaults.withCredentials = true


;(async () => {

  /* ---------------------------------------------
   * 0. axios interceptor（401 → event）
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
   * 4. Vue / Pinia（router 前）
   * ------------------------------------------- */
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  /* ---------------------------------------------
   * 5. Stores（auth / board）
   *    ※ Pinia が use された後に import
   * ------------------------------------------- */
  const { useAuthStore } = await import('./stores/auth')
  const { useHabitBoard } = await import('./stores/useHabitBoard')

  const auth = useAuthStore()
  const board = useHabitBoard()

  /* ======== 🔥 Debug Expose（今回の不具合の修正点） ======== */
  if (typeof window !== 'undefined') {
    window.useAuthStore = useAuthStore
    window.useHabitBoard = useHabitBoard
    window.__auth = auth
    window.__board = board
  }
  /* =========================================================== */

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
  const { injectAuthStore } = await import('./startup/auth-guards')
  injectAuthStore(auth)

  /* ---------------------------------------------
   * 8. router 登録 → mount
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