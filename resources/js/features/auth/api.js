// resources/js/features/auth/api.js
import axios from '@/bootstrap'
import { useAuthStore } from '@/stores/auth'

/**
 * 1) CSRF Cookie を確実に取る
 */
async function ensureCsrf () {
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
}

/**
 * 2) 安全な認証状態チェック (/api/auth/state)
 *    → 401 が絶対に出ない
 */
async function fetchAuthState () {
  const { data } = await axios.get('/api/auth/state', {
    withCredentials: true,
  })
  return data
}

/**
 * 3) ログイン
 *    - /login に POST する
 *    - ログイン直後は /api/auth/state でユーザーを取得
 *    - /api/user を叩くのは絶対 NG（401 の危険）
 */
export async function login ({ email, password }) {
  const store = useAuthStore()

  // CSRF Cookie
  await ensureCsrf()

  // ログイン本体
  await axios.post('/login', { email, password }, { withCredentials: true })

  // セッションが付くので、必ず state を見に行く
  const state = await fetchAuthState()

  if (state?.authenticated && state?.user) {
    store.setUser(state.user)
    store.fetchedOnce = true
    window.dispatchEvent(new CustomEvent('auth:logged-in'))
    return state.user
  }

  // ここはレアケース
  store.clear()
  store.fetchedOnce = true
  return null
}

/**
 * 4) ログアウト
 */
export async function logout () {
  const store = useAuthStore()

  await ensureCsrf()
  await axios.post('/logout', {}, { withCredentials: true })

  store.clear()
  store.fetchedOnce = true

  window.dispatchEvent(new CustomEvent('auth:logged-out'))
}

/**
 * 5) アプリ起動時に一度だけユーザーを同期
 *    /api/user は使わず /api/auth/state を使う
 */
export async function fetchMeOnce () {
  const store = useAuthStore()
  if (store.fetchedOnce) return store.isAuthenticated

  try {
    const state = await fetchAuthState()
    if (state?.authenticated && state?.user) {
      store.setUser(state.user)
      store.fetchedOnce = true
      return true
    }

    // 未ログイン
    store.clear()
    store.fetchedOnce = true
    return false
  } catch {
    store.clear()
    store.fetchedOnce = true
    return false
  }
}

/**
 * 6) 必要なときに明示的に /api/user を叩く
 *    ※ 基本は使わない。/api/auth/state の方が安定。
 */
export async function refreshMe () {
  const store = useAuthStore()

  const { data } = await axios.get('/api/user', {
    withCredentials: true,
  })

  store.setUser(data)
  store.fetchedOnce = true
  return data
}