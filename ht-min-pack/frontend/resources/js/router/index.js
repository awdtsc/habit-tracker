// resources/js/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// ---- 静的インポート（開発中の動的 import エラー回避 & 安定化）
import TodayTab from '../components/tabs/TodayTab.vue'
import HabitWeeklyBoard from '../components/HabitWeeklyBoard.vue'
import HabitsIndex from '../components/HabitsIndex.vue'
import HabitsCreate from '../components/HabitsCreate.vue'
import HabitsEdit from '../components/HabitsEdit.vue'
import Login from '../pages/Login.vue'

// Pinia 認証ストア
import { useAuthStore } from '../stores/auth'

/**
 * 完全 SPA。History モードのため、サーバ側は SPA シェルを返す必要があります。
 * 例（web.php）:
 *   Route::view('/{any}', 'app')->where('any', '^(?!api|sanctum).*$');
 */
const router = createRouter({
  history: createWebHistory(import.meta.env?.BASE_URL || '/'),
  routes: [
    // ルート直アクセスは Today へ
    { path: '/', redirect: { name: 'Today' } },

    // 認証：ログイン（公開）
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { title: 'Login', public: true },
    },

    // Breeze 互換：/dashboard は Today に統一
    { path: '/dashboard', redirect: { name: 'Today' } },

    // Today（認証必須）
    {
      path: '/dashboard/today',
      name: 'Today',
      component: TodayTab,
      meta: { title: 'Today', requiresAuth: true, keepAlive: true },
    },

    // 週ボード（認証必須）
    {
      path: '/dashboard/week',
      name: 'Weekly',
      component: HabitWeeklyBoard,
      meta: { title: 'Weekly', requiresAuth: true, keepAlive: true },
    },

    // 習慣一覧（認証必須）
    {
      path: '/habits',
      name: 'habits.index',
      component: HabitsIndex,
      meta: { title: 'Habits', requiresAuth: true },
    },

    // 新規作成（認証必須）
    {
      path: '/habits/create',
      name: 'habits.create',
      component: HabitsCreate,
      meta: { title: 'Create Habit', requiresAuth: true },
    },

    // 編集（認証必須）
    {
      path: '/habits/:id/edit',
      name: 'habits.edit',
      component: HabitsEdit,
      props: true,
      meta: { title: 'Edit Habit', requiresAuth: true },
    },

    // 404 は暫定で Today にリダイレクト
    { path: '/:pathMatch(.*)*', redirect: { name: 'Today' } },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

// =============================
// ページタイトル
// =============================
router.afterEach((to) => {
  if (to.meta?.title) document.title = `Habit | ${to.meta.title}`
})

// =============================
// 認証ガード（初回ロード時の“認証まだ”でのリダイレクトを防ぐ）
// =============================
// ポイント：
//  1. auth.fetchedOnce が false のときは「まだ認証判定してないだけ」とみなして素通り
//  2. fetchedOnce === true のときだけ「requiresAuth なのに未認証 → /login」に飛ばす
//  3. 既ログインで /login に来たら redirect 先 or Today に戻す
let isRedirecting = false

router.beforeEach((to) => {
  const auth = safeAuth()

  // 公開ページは基本素通り
  if (to.meta?.public) {
    // すでにログインしてるのに /login に来たときだけ戻す
    if (to.name === 'login' && auth.isAuthenticated) {
      const dest = getRedirectFromQuery(to)
      return dest
    }
    return true
  }

  // ここからは requiresAuth かどうかを見る
  const needAuth = !!to.meta?.requiresAuth

  // まだ認証チェックが終わってない（= fetchMeOnce がまだ）
  // この段階でリダイレクトすると “リロードするたびに /login に飛ぶ” になるので素通り
  if (!auth.fetchedOnce) {
    // console.info('[router] auth not ready yet → pass through', to.fullPath)
    return true
  }

  // 認証が必要で、かつ未認証
  if (needAuth && !auth.isAuthenticated) {
    if (isRedirecting) return true
    isRedirecting = true
    const redirect = to.fullPath || '/'
    return { name: 'login', query: { redirect } }
  }

  // ここまで来たらOK
  isRedirecting = false
  return true
})

// =============================
// ヘルパ
// =============================
function safeAuth() {
  try {
    return useAuthStore()
  } catch {
    // Pinia 初期化前でも落ちないようフォールバック
    return {
      isAuthenticated: false,
      fetchedOnce: false,
    }
  }
}

// Login.vue 側で使うやつ
export function getRedirectFromQuery(route) {
  const q = route?.query?.redirect
  if (typeof q === 'string' && q.startsWith('/')) return q
  return { name: 'Today' }
}

export default router