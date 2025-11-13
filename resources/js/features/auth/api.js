// resources/js/features/auth/api.js
import axios from '../../bootstrap'
import { useAuthStore } from '../../stores/auth'

/**
 * いちどだけ CSRF Cookie を取りに行く
 * （同一オリジン Sanctum 前提なので /sanctum/csrf-cookie でOK）
 */
async function ensureCsrf () {
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
}

/**
 * 401 を出さない“認証状態チェック”
 * routes/api.php の /api/auth/state に対応してる
 * shape: { authenticated: bool, user: {id, name, email} | null }
 */
async function fetchAuthState () {
  const { data } = await axios.get('/api/auth/state', {
    withCredentials: true,
  })
  return data
}

/**
 * ログイン処理（Sanctum + web セッション）
 * - ここでは **絶対に** /api/user を直撃しない
 * - ログイン直後の状態確認は /api/auth/state でやる
 */
export async function login ({ email, password }) {
  const store = useAuthStore()

  // 1) CSRF
  await ensureCsrf()

  // 2) ログイン本体
  await axios.post(
    '/login',
    { email, password },
    {
      withCredentials: true,
    },
  )

  // 3) 401 を出さないエンドポイントで現在ユーザーを取得
  const state = await fetchAuthState()

  if (state?.authenticated && state?.user) {
    store.setUser(state.user)
    // 初回フェッチ済みフラグがあるなら立てる
    if ('fetchedOnce' in store) {
      store.fetchedOnce = true
    }

    // ここでだけ push 初期化のイベントを投げる
    window.dispatchEvent(new CustomEvent('auth:logged-in'))

    return state.user
  }

  // ここに来るのは「パスワードは合っててセッションも出来たけど
  // /api/auth/state が user を返さなかった」みたいなレアケース
  // とりあえずストアはクリアしておく
  store.clear()
  if ('fetchedOnce' in store) {
    store.fetchedOnce = true
  }
  return null
}

/**
 * ログアウト
 */
export async function logout () {
  const store = useAuthStore()

  await ensureCsrf()
  await axios.post('/logout', {}, { withCredentials: true })

  store.clear()
  if ('fetchedOnce' in store) {
    store.fetchedOnce = true
  }

  window.dispatchEvent(new CustomEvent('auth:logged-out'))
}

/**
 * アプリ起動時に1回だけ現在のユーザーを同期したいとき用
 * （/login 画面では app.js 側で呼ばない設計になってるはず）
 */
export async function fetchMeOnce () {
  const store = useAuthStore()
  if (store.fetchedOnce) return !!store.isAuthenticated

  try {
    const state = await fetchAuthState()
    if (state?.authenticated && state?.user) {
      store.setUser(state.user)
      store.fetchedOnce = true
      return true
    }
    store.clear()
    store.fetchedOnce = true
    return false
  } catch (e) {
    store.clear()
    store.fetchedOnce = true
    return false
  }
}

/**
 * 必要になったときだけ /api/user を叩きたいならこれを使う
 * （でも通常は /api/auth/state の方が安全）
 */
export async function refreshMe () {
  const store = useAuthStore()
  const { data } = await axios.get('/api/user', { withCredentials: true })
  store.setUser(data)
  if ('fetchedOnce' in store) {
    store.fetchedOnce = true
  }
  return data
}