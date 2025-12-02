// resources/js/startup/auth-guards.js

// Pinia auth store を後で使う前提
let authStoreRef = null

export function injectAuthStore(auth) {
  authStoreRef = auth
}

/**
 * Router Guard（未ログイン → /login）
 */
export function setupAuthGuards(router) {

  router.beforeEach(async (to, from, next) => {

    // login ページは常に許可
    if (to.meta?.public) {
      return next()
    }

    // authStore がまだ注入されていない → 一旦通す（app.js で後から確定する）
    if (!authStoreRef) {
      console.warn('[auth-guards] authStore 未準備 → 一旦 next()')
      return next()
    }

    // 認証状態の確定を待つ
    await authStoreRef.waitUntilReady()

    // 未ログイン → loginへ
    if (!authStoreRef.isAuthenticated) {
      console.warn('[auth-guards] 未ログイン → redirect /login')
      return next({ name: 'login' })
    }

    // ログイン済み → 通過
    return next()
  })
}