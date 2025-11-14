// resources/js/startup/auth-guards.js

import { useAuthStore } from '@/stores/auth'

const AUTH_EVENT = 'auth:unauthorized'

export function setupAuthGuards(router) {
  const auth = useAuthStore()

  /* ============================================================
   * ① axios が 401 を検知した時のハンドラ
   * ------------------------------------------------------------
   *  auth.isAuthenticated に代入しないこと！
   * ============================================================ */
  window.addEventListener(AUTH_EVENT, () => {
    auth.user = null     // ← これだけでOK
    router.push({ name: 'login' })
  })

  /* ============================================================
   * ② ルーター前処理
   * ------------------------------------------------------------
   *  - public ページは素通り
   *  - protected ページは未認証なら login
   * ============================================================ */
  router.beforeEach(async (to, from, next) => {
    const isPublic = to.meta?.public === true

    // ---- 公開ページ（例: /login） ----
    if (isPublic) {
      if (to.name === 'login' && auth.isAuthenticated) {
        return next({ name: 'Today' })
      }
      return next()
    }

    // ---- 認証が必要なページ ----
    if (!auth.isAuthenticated) {
      try {
        const { fetchMeOnce } = await import('@/features/auth/api')
        await fetchMeOnce()

        // fetchMeOnce で user が復活したなら OK
        if (auth.isAuthenticated) {
          return next()
        }
        // 復活しなかった → login
        return next({ name: 'login' })

      } catch {
        return next({ name: 'login' })
      }
    }

    return next()
  })

  /* ============================================================
   * ③ afterEach（タイトル設定）
   * ============================================================ */
  router.afterEach((to) => {
    if (to.meta?.title) {
      document.title = `Habit | ${to.meta.title}`
    }
  })
}