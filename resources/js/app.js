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

// Sanctum Cookie
axios.defaults.withCredentials = true

;(async () => {

  /* -------------------------------------------------------
   * 0. Axios interceptor（401 → event 発火）
   * ----------------------------------------------------- */
  setupAxiosInterceptor()

  const IS_LOGIN = window.location.pathname.startsWith('/login')

  /* -------------------------------------------------------
   * 1. Backend 生存チェック
   * ----------------------------------------------------- */
  if (!await waitForBackendAlive()) {
    return renderOfflineScreen()
  }

  /* -------------------------------------------------------
   * 2. CSRF Cookie
   * ----------------------------------------------------- */
  if (!await fetchCsrfCookie()) {
    return renderOfflineScreen()
  }

  /* -------------------------------------------------------
   * 3. SPA root
   * ----------------------------------------------------- */
  const el = document.getElementById('app')
  if (!el) return

  /* -------------------------------------------------------
   * 4. Vue + Pinia（store はまだ呼ばない！！）
   * ----------------------------------------------------- */
  const app   = createApp(App)
  const pinia = createPinia()

  // Pinia → Router → mount
  app.use(pinia)
  app.use(router)
  await router.isReady()

  /* -------------------------------------------------------
   * ★★ 今日タブのハイブリッド復元ガード ★★
   *   - Week → Today のときだけ last_tab を適用
   *   - auto は復元しない（毎回再判定）
   * ----------------------------------------------------- */
  router.beforeEach((to, from, next) => {
    // Week → Today の場合のみ対象
    if (from.name === 'week' && to.name === 'today') {

      const last = localStorage.getItem('today_last_tab')

      if (last && last !== 'auto') {
        // 明示タブなら復元
        to.meta.restoreTodayTab = last
      } else {
        // auto は復元しない（＝今回の auto 判定を適用）
        to.meta.restoreTodayTab = null
      }
    }

    next()
  })

  /* -------------------------------------------------------
   * mount
   * ----------------------------------------------------- */
  app.mount(el)
  console.log('[APP] mounted')


  /* -------------------------------------------------------
   * 5. mount 後に store をロード（ここが最重要）
   * ----------------------------------------------------- */
  const { useAuthStore }       = await import('./stores/auth')
  const { useHabitBoardStore } = await import('./stores/habitBoard/store')

  const auth  = useAuthStore()
  const board = useHabitBoardStore()

  // Debug（Pinia ツリー上の本物の store）
  if (typeof window !== 'undefined') {
    window.__pinia = pinia
    window.__auth  = auth
    window.__board = board
    window.useAuthStore = useAuthStore
    window.useHabitBoardStore = useHabitBoardStore
  }

  /* -------------------------------------------------------
   * 6. restore()（認証確定） mount 後なので安全
   * ----------------------------------------------------- */
  try {
    await auth.restore()
    console.log('[startup] auth.restore done')
  } catch (err) {
    console.warn('[startup] restore failed', err)
  }

  /* -------------------------------------------------------
   * 7. Auth Guards
   * ----------------------------------------------------- */
  const { injectAuthStore, setupAuthGuards } =
    await import('./startup/auth-guards')

  injectAuthStore(auth)
  setupAuthGuards(router)

  /* -------------------------------------------------------
   * 8. Remind / Push
   * ----------------------------------------------------- */
  const { setupRemindSystem } = await import('./startup/remind')
  const { registerSwAndPush } = await import('./startup/push')

  setupRemindSystem()
  await registerSwAndPush(IS_LOGIN)

})()