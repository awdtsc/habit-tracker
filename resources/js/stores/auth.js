// resources/js/stores/auth.js
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,          // ログイン中のユーザー
    ready: false,        // ← 認証状態が「確定」しているか（最重要）
    restoring: false,    // restore() の二重実行防止
  }),

  getters: {
    isAuthenticated: (s) => !!s.user,
  },

  actions: {
    /* ============================================================
     * 1. restore（SPA 起動時に必ず1回だけ）
     * ------------------------------------------------------------
     * ・初回だけ fetchUser() を実行
     * ・backend 起動直後の 401/419 は正常
     * ・ready が true になるまで待つ
     * ============================================================ */
    async restore() {
      if (this.restoring || this.ready) {
        return this.user
      }

      this.restoring = true
      try {
        await this.fetchUser()
        return this.user
      } finally {
        this.restoring = false
      }
    },

    /* ============================================================
     * 2. fetchUser (/api/user)
     * ------------------------------------------------------------
     * ・401/419 は未ログインとして扱う（throw しない）
     * ・fetch 後は必ず ready=true にする（重要）
     * ============================================================ */
    async fetchUser() {
      try {
        const res = await axios.get('/api/user')
        this.user = res.data
        this.ready = true          // ← 認証状態が確定
        return this.user
      } catch (e) {
        const code = e?.response?.status

        if (code === 401 || code === 419) {
          this.user = null         // 未ログイン状態
          this.ready = true        // ← これ重要：未ログインでも認証状態は「確定」
          return null
        }

        // 予期しないエラーは throw
        this.ready = true
        throw e
      }
    },

    /* ============================================================
     * 3. waitUntilReady（認証状態の確定を必ず待つ）
     * ------------------------------------------------------------
     * ・WeeklyBoard / TodayTab / Router Guard で使用
     * ・ready==true になるまで待機する
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
     * 4. login
     * ------------------------------------------------------------
     * ・CSRF 初期化 → /login → fetchUser
     * ============================================================ */
    async login(credentials) {
      await axios.get('/sanctum/csrf-cookie')

      await axios.post('/login', credentials, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      // 認証確定させる
      return await this.fetchUser()
    },

    /* ============================================================
     * 5. logout
     * ------------------------------------------------------------
     * ・ログアウト成功後は user=null, ready=true
     * ============================================================ */
    async logout() {
      await axios.post('/logout', {}, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })

      this.user = null
      this.ready = true
    },
  },
})