// resources/js/app.js

import './bootstrap'
import Alpine from 'alpinejs'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// Auth store
import { useAuthStore } from './stores/auth'

// Backend utilities
import { waitForBackendAlive, renderOfflineScreen } from './startup/offline'
import { fetchCsrfCookie } from './startup/backend'

// Remind / Push
import { setupRemindSystem } from './startup/remind'
import { registerSwAndPush } from './startup/push'

// Alpine
window.Alpine = Alpine
Alpine.start()

// Sanctum cookie-mode
axios.defaults.withCredentials = true

;(async () => {

  const IS_LOGIN = window.location.pathname.startsWith('/login')

  // -------------------------------------------------------
  // 1. Backend check
  // -------------------------------------------------------
  if (!(await waitForBackendAlive())) {
    console.warn('[startup] backend not alive')
    return renderOfflineScreen()
  }

  // -------------------------------------------------------
  // 2. CSRF Cookie
  // -------------------------------------------------------
  if (!(await fetchCsrfCookie())) {
    console.warn('[startup] csrf cookie fetch failed')
    return renderOfflineScreen()
  }

  // -------------------------------------------------------
  // 3. #app check
  // -------------------------------------------------------
  const appEl = document.getElementById('app')
  if (!appEl) return

  // -------------------------------------------------------
  // 4. Vue App
  // -------------------------------------------------------
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  const auth = useAuthStore()

  // -------------------------------------------------------
  // 5. SPA 起動時の認証 restore
  // -------------------------------------------------------
  try {
    await auth.restore()
  } catch (e) {
    console.warn('[startup] auth.restore failed', e)
  }

  // -------------------------------------------------------
  // 6. router.ready → mount
  // -------------------------------------------------------
  await router.isReady()
  app.mount(appEl)
  console.log('[APP] Vue mounted')

  // -------------------------------------------------------
  // 7. Remind / Push 起動（認証状態確定後）
  // -------------------------------------------------------
  setupRemindSystem()
  await registerSwAndPush(IS_LOGIN)

})()