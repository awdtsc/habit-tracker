// resources/js/bootstrap.js
import axios from 'axios'

// =====================================================
// どこを API のベースにするか
// -----------------------------------------------------
// 優先順位：
// 1) Vite から渡す環境変数 VITE_BACKEND_URL
// 2) ブラウザの origin （= Laravel が直接出してるとき）
// 3) 最後の保険で http://localhost:8000
// =====================================================
const envBase =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL)
    ? import.meta.env.VITE_BACKEND_URL
    : null

const originBase = (typeof window !== 'undefined' && window.location)
  ? window.location.origin
  : null

// Laravelはふつう 8000 で動いてるので最後はこれに倒す
const API_BASE_URL = envBase || originBase || 'http://localhost:8000'

// =====================================================
// axios のグローバル設定（Sanctum ＋ Cookie 認証前提）
// =====================================================
axios.defaults.baseURL = API_BASE_URL
axios.defaults.withCredentials = true
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'
axios.defaults.timeout = 15000

// Sanctum が使う CSRF 名を Laravel デフォに合わせる
axios.defaults.xsrfCookieName = 'XSRF-TOKEN'
axios.defaults.xsrfHeaderName = 'X-XSRF-TOKEN'

// ブラウザからも確認できるようにしておく
window.axios = axios
window.__API_BASE_URL__ = API_BASE_URL

// =====================================================
// レスポンス・インターセプタ
// -----------------------------------------------------
// - 401 はここでは「知らせるだけ」→ 画面やrouterでリダイレクトする
// - 419 は 1 回だけ CSRF を取り直してリトライ
// =====================================================
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    const cfg = error?.config || {}

    // 401: 認証切れ or 未ログイン
    if (status === 401) {
      // ここではリダイレクトさせないでイベントだけ飛ばす
      window.dispatchEvent(
        new CustomEvent('auth:unauthorized', {
          detail: { url: cfg?.url || cfg?.baseURL }
        })
      )
      return Promise.reject(error)
    }

    // 419: CSRF 失効 → 1回だけ /sanctum/csrf-cookie を叩き直して元リクエストを再送
    if (status === 419 && !cfg.__csrfRetried) {
      try {
        cfg.__csrfRetried = true
        // CSRFは未ログインでも取れるのでそのまま
        await axios.get('/sanctum/csrf-cookie', {
          baseURL: API_BASE_URL,
          withCredentials: true,
        })
        return axios(cfg)
      } catch (e) {
        // 失敗したら普通に落とす
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default axios