// resources/js/router/routes.js

// -------------------------------------------------
// 公開ルート
// -------------------------------------------------
export const publicRoutes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/Login.vue'),
    meta: { public: true, title: 'Login' },
  },
]

// -------------------------------------------------
// 認証必須ルート
// -------------------------------------------------
export const privateRoutes = [
  {
    path: '/today',
    name: 'Today',
    component: () => import('@/components/tabs/TodayTab.vue'),
    meta: { title: '今日' },
  },
  {
    path: '/week',
    name: 'Week',
    component: () => import('@/components/HabitWeeklyBoard.vue'),
    meta: { title: '今週' },
  },
  {
    path: '/habits',
    name: 'HabitsIndex',
    component: () => import('@/components/HabitsIndex.vue'),
    meta: { title: '習慣一覧' },
  },
  {
    path: '/habits/create',
    name: 'HabitsCreate',
    component: () => import('@/components/HabitsCreate.vue'),
    meta: { title: '習慣追加' },
  },
  {
    path: '/habits/:id/edit',
    name: 'HabitsEdit',
    component: () => import('@/components/HabitsEdit.vue'),
    props: true,
    meta: { title: '習慣編集' },
  },
]

// -------------------------------------------------
// ルート一覧
// -------------------------------------------------
export const routes = [
  { path: '/', redirect: { name: 'Today' } },
  { path: '/dashboard', redirect: { name: 'Today' } },
  ...publicRoutes,
  ...privateRoutes,
  { path: '/:pathMatch(.*)*', redirect: { name: 'Today' } },
]