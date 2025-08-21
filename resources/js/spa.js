// resources/js/spa.js
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/App.vue'

// ルート定義（遅延読み込み）
const routes = [
  {
    path: '/dashboard/today',
    name: 'TodayTab',
    component: () => import('@/components/tabs/TodayTab.vue'),
  },
  {
    path: '/dashboard/week',
    name: 'HabitWeeklyBoard',
    component: () => import('@/components/HabitWeeklyBoard.vue'),
  },
  { path: '/dashboard', redirect: { name: 'TodayTab' } },
  { path: '/dashboard/:pathMatch(.*)*', redirect: { name: 'TodayTab' } },
]

const router = createRouter({
  history: createWebHistory(),     // サブディレクトリに置いてるなら createWebHistory('/base')
  routes,
  scrollBehavior() { return { top: 0 } },
})

createApp(App).use(router).mount('#app')