// resources/js/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'

// 📌 auth-guards は app.js で Pinia が作られてから動く
import { setupAuthGuards } from '@/startup/auth-guards'

/* =========================================================
 * Router 基本設定
 * ======================================================= */
const router = createRouter({
  // BASE_URL が無い場合でも "/" を使えるようにしておく
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
  routes,
})

/* =========================================================
 * グローバルガード登録
 * - ⚠️ auth(store) はここではまだ undefined
 * - safe guard（auth が undefined でも落ちない）なので OK
 * - 実際に auth 判定が動くのは app.js で restore 後
 * ======================================================= */
setupAuthGuards(router)

/* =========================================================
 * Export
 * ======================================================= */
export default router