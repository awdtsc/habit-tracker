// resources/js/stores/habitBoard/store.js
import { defineStore } from 'pinia'
import * as api from './api.js'
import { buildTodayViewModel } from './selectors.js'

/**
 * key = `${habit_id}_${date}_${slot}`
 */
function makeKey(id, date, slot) {
  return `${id}_${date}_${slot}`
}

function normalizeChecks(logs = []) {
  const out = {}
  for (const log of logs) {
    const key = makeKey(log.habit_id, log.date, log.time_slot)
    out[key] = log
  }
  return out
}

export const useHabitBoardStore = defineStore('habitBoard', {
  state: () => ({
    /* -----------------------------
     * 今日（Today）
     * --------------------------- */
    todayDate: null,
    nowSlot: null,

    todayPlanned: [],   // /api/today の planned
    todayLogs: {},      // 正規化された log map
    todayVM: null,      // buildTodayViewModel の結果

    /* -----------------------------
     * 週（Weekly）
     * --------------------------- */
    weekStart: null,
    weeklyHabits: [],
    weeklyChecks: {},

    /* -----------------------------
     * 状態
     * --------------------------- */
    loading: false,
    lastFetchedAt: null,
  }),

  getters: {
    /**
     * selectors.js が依存する getLog
     */
    getLog: (state) => (habit_id, date, slot) => {
      return state.todayLogs[makeKey(habit_id, date, slot)] || null
    },
  },

  actions: {

    /* ============================================================
     * 今日 /api/today
     * ========================================================== */
    async fetchToday() {
      this.loading = true
      try {
        const data = await api.apiFetchToday()

        // 今日の基本情報
        this.todayDate = data.date
        this.nowSlot   = data.now_slot ?? null
        this.todayPlanned = data.planned ?? []

        // /api/today のログ配列 → 正規化
        const logs = data.logs ?? data.today_logs ?? []
        this.todayLogs = normalizeChecks(logs)

        // ViewModel 再構築
        this.todayVM = buildTodayViewModel({
          planned : this.todayPlanned,
          getLog  : this.getLog,
          date    : this.todayDate,
          nowSlot : this.nowSlot,
        })

        this.lastFetchedAt = Date.now()
      }
      finally {
        this.loading = false
      }
    },


    /* ============================================================
     * 週 /api/weekly-board
     * ========================================================== */
    async fetchWeeklyBoard(params = {}) {
      this.loading = true
      try {
        const data = await api.apiFetchWeeklyBoard(params)

        this.weekStart     = data.start
        this.weeklyHabits  = data.habits ?? []

        const checks = data.checks ?? data.logs ?? []
        this.weeklyChecks = normalizeChecks(checks)

        this.lastFetchedAt = Date.now()
      }
      finally {
        this.loading = false
      }
    },


    /* ============================================================
     * toggle (POST /api/habit-logs/toggle)
     * ========================================================== */
    async toggleLog(payload) {
      const res = await api.apiToggleHabitLog(payload)

      const log = res.log
      if (log) {
        // 今日の log 更新
        const key = makeKey(log.habit_id, log.date, log.time_slot)
        this.todayLogs[key] = log
      }

      // 今日の日付が既に fetch 済みなら VM を再計算
      if (this.todayDate) {
        this.todayVM = buildTodayViewModel({
          planned : this.todayPlanned,
          getLog  : this.getLog,
          date    : this.todayDate,
          nowSlot : this.nowSlot,
        })
      }

      return res
    },
  }
})
