// resources/js/stores/habitBoard/store.js
import { defineStore } from 'pinia'

export const useHabitBoardStore = defineStore('habitBoard', {
  state: () => ({
    habits: [],     // /api/weekly-board の生データ
    checks: {},     // habit_logs の map
    start: null,    // 週開始（日付）
    lastFetchedAt: null,
    loading: false,
    rates: new Array(7).fill(0), // 達成率
  }),

  actions: {
    replaceHabits(habits) {
      this.habits = habits
    },

    replaceChecks(checks) {
      this.checks = checks
    },

    setStart(v) {
      this.start = v
    },

    setLoading(v) {
      this.loading = v
    },

    setRates(r) {
      this.rates = r
    },
  }
})
