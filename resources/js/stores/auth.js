import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    fetchedOnce: false,
  }),
  getters: {
    isAuthenticated: (s) => !!s.user,
  },
  actions: {
    setUser(u) { this.user = u; this.fetchedOnce = true },
    clear()    { this.user = null; this.fetchedOnce = true },
  }
})