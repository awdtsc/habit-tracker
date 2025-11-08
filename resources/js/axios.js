// resources/js/axios.js
import axios from 'axios'

// 同一オリジン想定
axios.defaults.baseURL = location.origin
axios.defaults.withCredentials = true
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'
axios.defaults.timeout = 15000

// 401/419 共通ハンドリング（※リダイレクトは絶対にしない）
axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status
    const cfg = err?.config || {}

    // 401 は “通知だけ” に留める（ルーターガードに任せる）
    if (status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { url: cfg?.url } }))
      return Promise.reject(err)
    }

    // 419 は 1 回だけ CSRF を取り直して再送
    if (status === 419 && !cfg.__csrfRetried) {
      try {
        cfg.__csrfRetried = true
        await axios.get('/sanctum/csrf-cookie', { baseURL: '/' })
        return axios(cfg)
      } catch (e) {
        // 取得失敗時はそのままエラー
      }
    }

    return Promise.reject(err)
  }
)

export default axios