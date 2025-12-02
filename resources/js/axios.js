// resources/js/axios.js
import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

// ==============================
// Axios base config
// ==============================
axios.defaults.baseURL = location.origin
axios.defaults.withCredentials = true
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'
axios.defaults.timeout = 15000

// ==============================
// 「ログアウトさせないでいい 401」
// ==============================
const SAFE_401_PATHS = [
  '/api/weekly-board',
  '/api/today',
  '/api/logs',
  '/api/habit-logs',
  '/api/remind-tasks',
]

// ==============================
// Interceptor
// ==============================
axios.interceptors.response.use(
  (res) => res,

  async (err) => {
    const status = err?.response?.status
    const cfg = err?.config || {}
    const url = cfg?.url || ''

    const authStore = useAuthStore()

    // ----------------------------
    // 401 Unauthorized
    // ----------------------------
    if (status === 401) {
      // 1) safe401 → ログアウトしない（UI にはイベントだけ）
      if (SAFE_401_PATHS.some(p => url.includes(p))) {
        console.warn('[Axios] SAFE 401: keep session. url=', url)
        window.dispatchEvent(
          new CustomEvent('auth:unauthorized-soft', { detail: { url } })
        )
        return Promise.reject(err)
      }

      // 2) 本当に認証が切れた場合 → logout + /login
      console.warn('[Axios] HARD 401: session expired. logout.')
      authStore.logout()

      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }

      return Promise.reject(err)
    }

    // ----------------------------
    // 419: CSRF トークン失効 → 1 回だけ retry
    // ----------------------------
    if (status === 419 && !cfg.__csrfRetried) {
      try {
        cfg.__csrfRetried = true
        await axios.get('/sanctum/csrf-cookie', { baseURL: '/' })
        return axios(cfg)
      } catch {
        /* CSRF 失敗 → そのまま落とす */
      }
    }

    return Promise.reject(err)
  }
)

export default axios