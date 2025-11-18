// resources/js/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'

// -------------------------------------------------
// Router
// -------------------------------------------------
const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router