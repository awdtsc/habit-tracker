// resources/js/startup/backend.js

import axios from '../bootstrap'

/* ============================================================
 * 共通 sleep
 * ============================================================ */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/* ============================================================
 * 1) Backend 生存確認（Laravel が起動しているか）
 * ------------------------------------------------------------
 * - Sanctum の /csrf-cookie は認証不要で常に 204 を返す
 * - 起動前は Connection refused / timeout
 * - 起動した瞬間に true を返すので SPA レースが消える
 * ============================================================ */
export async function waitForBackendAlive({
  timeoutMs = 8000,
  interval = 400,
} = {}) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
      return true
    } catch (_) {
      // 起動待ち（静かに retry）
    }
    await sleep(interval)
  }

  return false
}

/* ============================================================
 * 2) CSRF Cookie の取得（生存確認後）
 * ------------------------------------------------------------
 * ※ Laravel Sanctum では初回アクセスで必須
 * ※ token ではなく session cookie を発行する
 * ============================================================ */
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

/* ============================================================
 * 3) Axios Response Interceptor（401 → AUTH_EVENT）
 * ------------------------------------------------------------
 * Codex 推奨ポイント：
 *   - 401 は router ではなく "auth layer" で統一処理
 *   - beforeEach の中では扱わない（バグ源）
 *   - redirect は auth-guards.js が担当する
 * ============================================================ */

const AUTH_EVENT = 'auth:unauthorized'

// 既に interceptor がいる場合の多重登録を防止
let interceptorInstalled = false

export function setupAxiosInterceptor() {
  if (interceptorInstalled) return
  interceptorInstalled = true

  axios.interceptors.response.use(
    (res) => res,

    (err) => {
      const status = err?.response?.status

      // --------- 401 Unauthorized ---------
      if (status === 401) {
        console.warn('[axios] 401 detected → dispatch AUTH_EVENT')
        window.dispatchEvent(new Event(AUTH_EVENT))
      }

      // 何があっても Promise.reject して Vue に通知
      return Promise.reject(err)
    }
  )
}