// resources/js/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'

/**
 * Router は「ルート定義だけ」を担当する。
 * グローバルガード（認証など）は app.js 側で register する。
 * これにより HMR 安定・循環参照削減・SPA bootstrap の順序が固定される。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes,
})

export default router