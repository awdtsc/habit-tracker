// resources/js/stores/auth.js
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    fetchedOnce: false,
  }),

  getters: {
    isAuthenticated: (s) => !!s.user,
  },

  actions: {
    /* ============================================================
     * 1. 現在のユーザー (/api/user)
     * ------------------------------------------------------------
     * ・401 は通常状態なので throw しない
     * ・成功時は this.user をセット
     * ============================================================ */
    async fetchUser() {
      try {
        const res = await axios.get('/api/user')
        this.user = res.data
        return this.user
      } catch (e) {
        if (e?.response?.status === 401) {
          this.user = null
          return null
        }
        throw e
      } finally {
        this.fetchedOnce = true
      }
    },

    /* ============================================================
     * 2. ログイン（CSRF → /login POST → fetchUser）
     * ------------------------------------------------------------
     * Breeze は redirect を返すため、XMLHttpRequest を明示
     * ============================================================ */
    async login(credentials) {
      await axios.get('/sanctum/csrf-cookie')

      await axios.post('/login', credentials, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      return await this.fetchUser()
    },

    /* ============================================================
     * 3. ログアウト
     * ============================================================ */
    async logout() {
      await axios.post('/logout', {}, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      this.user = null
      this.fetchedOnce = true
    },
  },
})
