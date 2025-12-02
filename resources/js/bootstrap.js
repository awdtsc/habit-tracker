// resources/js/bootstrap.js
import axios from 'axios'

/* =====================================================
 * API ベースURLの決定（最重要）
 * -----------------------------------------------------
 * 1) VITE_BACKEND_URL があればそれを採用
 * 2) なければ常に http://localhost:8000 を採用
 *
 * ※ window.location.origin を使うと 5173 を参照して
 *    「/login が Vite に行く → ログイン不能」になるため禁止。
 * ===================================================*/

// .env の VITE_BACKEND_URL（例: http://localhost:8000）
const envBase =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_BACKEND_URL)
    ? import.meta.env.VITE_BACKEND_URL
    : null

// fallback は必ず Laravel 側の 8000
const API_BASE_URL = envBase || 'http://localhost:8000'

/* =====================================================
 * axios グローバル設定（Sanctum Cookie 認証）
 * ===================================================*/
axios.defaults.baseURL = API_BASE_URL
axios.defaults.withCredentials = true
axios.defaults.timeout = 15000

// HTML を絶対に返させない（SPA が壊れるため）
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'
axios.defaults.headers.common['Accept'] = 'application/json'

// Sanctum の CSRF Cookie 名
axios.defaults.xsrfCookieName = 'XSRF-TOKEN'
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN'

// デバッグ用
window.axios = axios
window.__API_BASE_URL__ = API_BASE_URL

/* =====================================================
 * Response Interceptor
 * -----------------------------------------------------
 * 401 → router に処理を任せる（画面遷移はしない）
 * 419 → CSRF を再取得して 1 回だけ再送
 * ===================================================*/
axios.interceptors.response.use(
  (response) => response,

  async (error) => {
    const status = error?.response?.status
    const cfg = error?.config || {}

    // 401（未認証 / セッション切れ）
    if (status === 401) {
      window.dispatchEvent(
        new CustomEvent('auth:unauthorized', {
          detail: { url: cfg.url || cfg.baseURL },
        })
      )
      return Promise.reject(error)
    }

    // 419（CSRF 切れ）→ 1 回だけリトライ
    if (status === 419 && !cfg.__csrfRetried) {
      cfg.__csrfRetried = true

      try {
        await axios.get('/sanctum/csrf-cookie', {
          baseURL: API_BASE_URL,
          withCredentials: true,
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        })

        return axios(cfg)
      } catch (_) {
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default axios