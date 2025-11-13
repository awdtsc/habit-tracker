// resources/js/app.js
import './bootstrap'
import Alpine from 'alpinejs'
import axios from './bootstrap'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { registerServiceWorker, setupPush } from './push'
import { useAuthStore } from './stores/auth'
import { fetchMeOnce } from './features/auth/api'

// ---------- 起動ログ ----------
console.log('[APP] app.js loaded')

// ---------- Alpine ----------
window.Alpine = Alpine
Alpine.start()

// ---------- リマインド用イベントバス ----------
const bus = new EventTarget()
window.__remindBus = bus
window.__remindQueue = window.__remindQueue || []

// ---------- SW メッセージ ----------
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    try {
      const data = e?.data || {}
      console.log('[APP] SW message raw =', data)

      // 新: taskId 直指定
      if (data.type === 'OPEN_REMIND_MODAL' && data.taskId != null) {
        const taskId = Number(data.taskId)
        window.__remindQueue.push(taskId)
        const ev = new CustomEvent('open-remind-modal', { detail: { taskId } })
        bus.dispatchEvent(ev)
        window.dispatchEvent(ev)
        return
      }

      // 旧: habitId → API 解決
      if (data.type === 'OPEN_MODAL' && data.habitId != null) {
        console.warn('[APP] Fallback OPEN_MODAL (habitId only). Resolving to taskId...')
        const habitId = Number(data.habitId)
        try {
          const { data: res } = await axios.get('/api/remind-tasks/latest-by-habit', {
            params: { habit_id: habitId },
            withCredentials: true,
          })
          const taskId = res?.task?.id
          if (taskId) {
            window.__remindQueue.push(taskId)
            const ev = new CustomEvent('open-remind-modal', { detail: { taskId } })
            bus.dispatchEvent(ev)
            window.dispatchEvent(ev)
          } else {
            console.warn('[APP] No pending task for habit', habitId)
          }
        } catch (err) {
          console.error('[APP] latest-by-habit request failed', err?.response?.data || err)
        }
      }
    } catch (err) {
      console.error('[APP] SW message handler error', err)
    }
  })
}

// ---------- URL (?remindTask=123) → イベント化 ----------
function dispatchOpenModalByQuery() {
  try {
    const url = new URL(location.href)
    const q = url.searchParams.get('remindTask')
    if (q) {
      const taskId = Number(q)
      console.log('[APP] query remindTask found → dispatch', taskId)
      window.__remindQueue.push(taskId)
      const ev = new CustomEvent('open-remind-modal', { detail: { taskId } })
      bus.dispatchEvent(ev)
      window.dispatchEvent(ev)
      history.replaceState({}, '', location.pathname + location.hash)
    }
  } catch (e) {
    console.warn('[APP] dispatchOpenModalByQuery failed', e)
  }
}

// ---------- オフライン表示 ----------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function waitForApi({ timeoutMs = 10000, interval = 500 } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      // 認証不要で 200/204 が返るやつだけ
      await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
      return true
    } catch {}
    await sleep(interval)
  }
  return false
}

function renderOffline() {
  const el = document.getElementById('app')
  if (!el) return
  el.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div class="max-w-md w-full rounded-lg bg-white shadow p-6 text-center">
        <h2 class="text-lg font-semibold mb-2">サーバに接続できません</h2>
        <p class="text-sm text-gray-600 mb-4">Laravel(8000) / Vite(4000) を起動して再読み込みしてください。</p>
        <button id="reloadBtn" class="px-4 py-2 rounded bg-blue-600 text-white">再読み込み</button>
      </div>
    </div>`
  document.getElementById('reloadBtn')?.addEventListener('click', () => location.reload())
}

// =====================================================
// 起動フロー（順番大事）
// =====================================================
;(async () => {
  // /login かどうかだけ先に見ておく
  const onLogin = location.pathname.startsWith('/login')

  // 1) Backend 生存確認（401を出さない）
  const alive = await waitForApi()
  if (!alive) {
    console.error('[APP] Backend not reachable')
    renderOffline()
    return
  }

  // 2) CSRF Cookie（ここで1回だけ）※withCredentialsつき
  try {
    await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
    console.log('[APP] axios csrf-cookie fetched')
  } catch (e) {
    console.error('[APP] csrf-cookie failed', e)
    renderOffline()
    return
  }

  // 3) Dev オートログイン（/login のときはやらない）
  const DEV_AUTOLOGIN = import.meta.env?.VITE_DEV_AUTOLOGIN === '1'
  const DEV_EMAIL = import.meta.env?.VITE_DEV_EMAIL
  const DEV_PASSWORD = import.meta.env?.VITE_DEV_PASSWORD
  if (!onLogin && DEV_AUTOLOGIN && DEV_EMAIL && DEV_PASSWORD) {
    try {
      await axios.post('/login', { email: DEV_EMAIL, password: DEV_PASSWORD }, {
        baseURL: '/',
        withCredentials: true,
      })
      console.log('[APP] ログイン成功（dev autologin）')
    } catch (e) {
      console.warn('[APP] dev autologin failed or skipped', e?.response?.status || e?.message || e)
    }
  }

  // 4) Vue + Pinia 準備
  const el = document.getElementById('app')
  if (!el) {
    console.warn('[APP] #app element not found')
    return
  }

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  // 5) 認証状態フェッチ（←ここをマウントの“前”にもってくるのがポイント）
  if (!onLogin) {
    // /api/auth/state を叩く（features/auth/api.js の中でCSRFもやるが、ここはもう取得済みなので早く終わる）
    await fetchMeOnce().catch(() => false)
  }

  // 6) ここでようやくマウント
  app.mount(el)
  console.log('[APP] Vue mounted')

  // 7) ルート保護：未認証で保護ページに居るなら /login に避難
  if (!onLogin) {
    const auth = useAuthStore()
    const cur = router.currentRoute.value
    if (cur.meta?.requiresAuth && !auth.isAuthenticated) {
      router.replace({ name: 'login', query: { redirect: cur.fullPath || '/' } })
    }
  }

  // 8) URL の ?remindTask=... 対応
  dispatchOpenModalByQuery()

  // 9) SW 登録 ＆ 認証済みなら Push 初期化
  try {
    const reg = await registerServiceWorker()
    console.log('[APP] Service Worker registered', reg)

    const auth = useAuthStore()
    if (!onLogin && auth.isAuthenticated) {
      const r = await setupPush()
      if (r.ok) console.log('[APP] Push subscription success')
      else      console.warn('[APP] Push subscription failed', r.reason)
    } else {
      console.log('[APP] Skip push init (onLogin or not authenticated)')
    }
  } catch (err) {
    console.error('[APP] Service Worker or Push setup failed', err)
  }

  // 10) ログイン直後に Push を遅延初期化
  window.addEventListener('auth:logged-in', async () => {
    try {
      const r = await setupPush()
      if (r.ok) console.log('[APP] Push subscription success (after login)')
      else      console.warn('[APP] Push subscription failed (after login)', r.reason)
    } catch (e) {
      console.error('[APP] Push init failed (after login)', e)
    }
  })
})()