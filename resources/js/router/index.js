// resources/js/router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// ---- Static imports ----
import TodayTab from '../components/tabs/TodayTab.vue'
import HabitWeeklyBoard from '../components/HabitWeeklyBoard.vue'
import HabitsIndex from '../components/HabitsIndex.vue'
import HabitsCreate from '../components/HabitsCreate.vue'
import HabitsEdit from '../components/HabitsEdit.vue'
import Login from '../pages/Login.vue'

// -------------------------------------------------
// Router
// -------------------------------------------------
const router = createRouter({
  history: createWebHistory(),

  routes: [
    { path: '/', redirect: { name: 'Today' } },

    // ---- Public ----
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { public: true, title: 'Login' },
    },

    // ---- Private ----
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
  ],
})

export default router