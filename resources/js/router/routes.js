// resources/js/router/routes.js
import TodayTab from '../components/tabs/TodayTab.vue'
import HabitWeeklyBoard from '../components/HabitWeeklyBoard.vue'
import HabitsIndex from '../components/HabitsIndex.vue'
import HabitsCreate from '../components/HabitsCreate.vue'
import HabitsEdit from '../components/HabitsEdit.vue'
import Login from '../pages/Login.vue'

// 公開ルート
export const publicRoutes = [
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { public: true, title: 'Login' },
  },
]

// 認証必須ルート
export const privateRoutes = [
  {
    path: '/today',
    name: 'Today',
    component: TodayTab,
    meta: { title: '今日' },
  },
  {
    path: '/week',
    name: 'Week',
    component: HabitWeeklyBoard,
    meta: { title: '今週' },
  },
  {
    path: '/habits',
    name: 'HabitsIndex',
    component: HabitsIndex,
    meta: { title: '習慣一覧' },
  },
  {
    path: '/habits/create',
    name: 'HabitsCreate',
    component: HabitsCreate,
    meta: { title: '習慣追加' },
  },
  {
    path: '/habits/:id/edit',
    name: 'HabitsEdit',
    component: HabitsEdit,
    props: true,
    meta: { title: '習慣編集' },
  },
]

// ルート一覧（index.js からはこれだけ import する）
export const routes = [
  { path: '/', redirect: { name: 'Today' } },
  ...publicRoutes,
  ...privateRoutes,
]