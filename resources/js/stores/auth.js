// resources/js/stores/auth.js
import { defineStore } from 'pinia'
import axios from 'axios'
import { watch } from 'vue'
import { storeToRefs } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,        // ログインユーザー
    ready: false,      // 認証状態が確定したか
    restoring: false,  // restore() の二重実行防止
    fetchedOnce: false // 初回 fetchUser が完了したか
  }),

  getters: {
    isAuthenticated: (s) => !!s.user,
  },

  actions: {

    /* ============================================
     * 1. restore（SPA起動時）
     * ============================================ */
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

    /* ============================================
     * 2. fetchUser（/api/user）
     * ============================================ */
    async fetchUser() {
      try {
        const res = await axios.get('/api/user')
        this.user = res.data
        this.ready = true
        this.fetchedOnce = true

        window.dispatchEvent(new CustomEvent('auth:ready'))
        window.dispatchEvent(new CustomEvent('auth:logged-in'))

        return this.user

      } catch (e) {
        const code = e?.response?.status

        if (code === 401 || code === 419) {
          this.user = null
          this.ready = true
          this.fetchedOnce = true

          window.dispatchEvent(new CustomEvent('auth:ready'))
          return null
        }

        this.ready = true
        this.fetchedOnce = true
        throw e
      }
    },

    /* ============================================
     * 3. waitUntilReady（修正版）
     * ============================================ */
    async waitUntilReady() {
      // すでに ready ならすぐ resolve
      if (this.ready) return

      const { ready } = storeToRefs(this)

      // ready が true になるまで watch
      return await new Promise((resolve) => {
        const stop = watch(
          ready,
          (v) => {
            if (v) {
              stop()
              resolve()
            }
          },
          { immediate: true }
        )
      })
    },

    /* ============================================
     * 4. login
     * ============================================ */
    async login(credentials) {
      await axios.get('/sanctum/csrf-cookie')

      await axios.post('/login', credentials, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      return await this.fetchUser()
    },

    /* ============================================
     * 5. logout
     * ============================================ */
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
