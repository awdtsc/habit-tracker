// resources/js/startup/offline.js

/**
 * Promise-based sleep
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Backend の生存確認（Laravel が死んでるときの fallback 対応）
 *
 * ここでは Sanctum の /sanctum/csrf-cookie が
 * 認証不要＆最も軽量のエンドポイントなので使う。
 */
export async function waitForBackendAlive({
  timeoutMs = 10000,
  interval = 500,
} = {}) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      // 認証不要で 200/204 が返るやつだけ
      await fetch('/sanctum/csrf-cookie', {
        method: 'GET',
        credentials: 'include',
      })
      return true // ← backend reachable！
    } catch (err) {
      // console.debug('[offline] check failed', err)
    }
    await sleep(interval)
  }

  return false // ← timeout
}

/**
 * オフライン画面を描画する
 * app.js の「#app が存在しない or backend 不達」ケースで使う
 */
export function renderOfflineScreen() {
  const el = document.getElementById('app')
  if (!el) return

  el.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div class="max-w-md w-full rounded-lg bg-white shadow p-6 text-center">
        <h2 class="text-lg font-semibold mb-2">サーバに接続できません</h2>
        <p class="text-sm text-gray-600 mb-4">
          Laravel(8000) / Vite(5173) を起動して再読み込みしてください。
        </p>
        <button id="reloadBtn" class="px-4 py-2 rounded bg-blue-600 text-white">
          再読み込み
        </button>
      </div>
    </div>
  `

  document
    .getElementById('reloadBtn')
    ?.addEventListener('click', () => location.reload())
}