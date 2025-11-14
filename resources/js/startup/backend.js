// resources/js/startup/backend.js
import axios from '../bootstrap'

// 小さな sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * バックエンドの生存確認
 * （Laravelサーバーが起動していない場合は即座に SPA を止める）
 */
export async function waitForBackend({
  timeoutMs = 8000,
  interval = 400,
} = {}) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      // Sanctum CSRF Cookie は認証不要で 204 を返す唯一のAPI
      await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
      return true
    } catch (err) {
      // まだ起動していない可能性
    }
    await sleep(interval)
  }

  return false
}

/**
 * CSRF Cookie の取得（生存確認後に呼ぶ）
 */
export async function fetchCsrfCookie() {
  try {
    await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
    console.log('[startup] CSRF Cookie fetched')
    return true
  } catch (err) {
    console.error('[startup] Failed to fetch CSRF Cookie', err)
    return false
  }
}