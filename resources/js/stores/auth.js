// resources/js/stores/auth.js
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,        // ログイン中ユーザー
    ready: false,      // 認証状態が確定したか
    restoring: false,  // restore() の二重実行防止
    fetchedOnce: false // ★追加：初回の fetchUser が成功したか
  }),

  getters: {
    isAuthenticated: (s) => !!s.user,
  },

  actions: {

    /* ============================================================
     * 1. restore（SPA 起動時）
     * ============================================================ */
    async restore() {
      if (this.restoring || this.ready) return this.user

      this.restoring = true
      try {
        await this.fetchUser()
        return this.user
      } finally {
        this.restoring = false
      }
    },

    /* ============================================================
     * 2. fetchUser（/api/user）
     * ============================================================ */
    async fetchUser() {
      try {
        const res = await axios.get('/api/user')
        this.user = res.data
        this.ready = true
        this.fetchedOnce = true   // ★追加：初回認証成功

        // イベント発火（WeeklyBoard が反応する）
        window.dispatchEvent(new CustomEvent('auth:ready'))
        window.dispatchEvent(new CustomEvent('auth:logged-in'))

        return this.user

      } catch (e) {
        const code = e?.response?.status

        if (code === 401 || code === 419) {
          this.user = null
          this.ready = true
          this.fetchedOnce = true  // ★未ログインだとしても認証確定

          // 401 の場合も ready として扱う
          window.dispatchEvent(new CustomEvent('auth:ready'))

          return null
        }

        this.ready = true
        this.fetchedOnce = true
        throw e
      }
    },

    /* ============================================================
     * 3. waitUntilReady
     * ============================================================ */
    async waitUntilReady() {
      if (this.ready) return

      await new Promise((resolve) => {
        const unwatch = this.$watch(
          () => this.ready,
          (v) => {
            if (v) {
              unwatch()
              resolve()
            }
          }
        )
      })
    },

    /* ============================================================
     * 4. login（CSRF → /login → fetchUser）
     * ============================================================ */
    async login(credentials) {
      await axios.get('/sanctum/csrf-cookie')

      await axios.post('/login', credentials, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      return await this.fetchUser()
    },

    /* ============================================================
     * 5. logout
     * ============================================================ */
    async logout() {
      await axios.post('/logout', {}, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      this.user = null
      this.ready = true
      this.fetchedOnce = true

      window.dispatchEvent(new CustomEvent('auth:logged-out'))
    },
  },
})
