// resources/js/app.js

import './bootstrap'
import Alpine from 'alpinejs'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// Backend / Auth
import { waitForBackendAlive, renderOfflineScreen } from './startup/offline'
import { fetchCsrfCookie } from './startup/backend'
import { setupAuthGuards } from './startup/auth-guards'

// Remind（SW message + URL query + event bus）
import { setupRemindSystem } from './startup/remind'

// Push
import { registerSwAndPush } from './startup/push'

// Alpine init
window.Alpine = Alpine
Alpine.start()

// SPA + Sanctum は必須
axios.defaults.withCredentials = true


; (async () => {

  // -------------------------------------------------------
  // 正確な login 判定
  // history mode では /login が / に見えることがあるため
  // -------------------------------------------------------
  const raw = location.pathname.replace(/\/+$/, '')   // 末尾スラッシュ除去
  const IS_LOGIN = (raw === '/login')

  // -------------------------------------------------------
  // STEP 1: Backend 生存チェック
  // -------------------------------------------------------
  if (!(await waitForBackendAlive())) {
    console.warn('[startup] backend not alive')
    return renderOfflineScreen()
  }

  // -------------------------------------------------------
  // STEP 2: CSRF Cookie をセット
  // -------------------------------------------------------
  const ok = await fetchCsrfCookie()
  if (!ok) {
    console.warn('[startup] csrf cookie fetch failed')
    return renderOfflineScreen()
  }
  console.log('[startup] CSRF Cookie fetched')

  // -------------------------------------------------------
  // STEP 3: #app 存在確認
  // -------------------------------------------------------
  const appEl = document.getElementById('app')
  if (!appEl) {
    console.warn('[APP] #app element not found')
    return
  }

  // -------------------------------------------------------
  // STEP 4: Vue アプリ構築
  // -------------------------------------------------------
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  // -------------------------------------------------------
  // STEP 5: 認証ガード登録
  // -------------------------------------------------------
  setupAuthGuards(router)

  // -------------------------------------------------------
  // STEP 6: ログイン画面以外なら /api/user を事前ロード
  // -------------------------------------------------------
  if (!IS_LOGIN) {
    try {
      const { fetchMeOnce } = await import('./features/auth/api')
      await fetchMeOnce().catch(() => false)
    } catch (e) {
      console.warn('[startup] fetchMeOnce failed', e)
    }
  }

  // -------------------------------------------------------
  // STEP 7: Router 準備完了
  // -------------------------------------------------------
  await router.isReady()

  // -------------------------------------------------------
  // STEP 8: Vue マウント
  // -------------------------------------------------------
  app.mount(appEl)
  console.log('[APP] Vue mounted successfully')

  // -------------------------------------------------------
  // STEP 9: Remind / Push 起動
  // -------------------------------------------------------
  setupRemindSystem()
  await registerSwAndPush(IS_LOGIN)

})()