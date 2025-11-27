// resources/js/stores/habitBoard/store.js
//------------------------------------------------------------
// HabitBoard Store v3（Today / Weekly / ToggleLog）
//   - API の生データだけ保持
//   - TodayVM を store 側で組み立てる（View Model）
//------------------------------------------------------------

import { defineStore } from 'pinia'
import * as api from './api.js'

/* ------------------------------------------------------------
 * 共通ユーティリティ
 * ---------------------------------------------------------- */
const makeKey = (id, date, slot) => `${id}_${date}_${slot}`

const normalizeChecks = (logs = []) => {
  const out = {}
  for (const log of logs) {
    out[makeKey(log.habit_id, log.date, log.time_slot)] = log
  }
  return out
}

/* ------------------------------------------------------------
 * Store 本体
 * ---------------------------------------------------------- */
export const useHabitBoardStore = defineStore('habitBoard', {
  state: () => ({
    /* ------------------ Today ------------------ */
    todayDate: null,
    nowSlot: null,               // 1〜4（0=anytime は使用しない）
    todayPlanned: [],            // [{ h, today_log, pending_task }]
    todayLogs: {},               // { "id_date_slot": {…} }

    /* ------------------ Weekly ----------------- */
    weekStart: null,
    weeklyHabits: [],
    weeklyChecks: {},

    /* ------------------ Common ----------------- */
    loading: false,
    lastFetchedAt: null,
  }),

  /* ------------------------------------------------------------
   * Getters（VM を組み立て）
   * ---------------------------------------------------------- */
  getters: {
    /* Today / Weekly 共通ログ取得 */
    getLog: (state) => (id, date, slot) =>
      state.todayLogs[makeKey(id, date, slot)] || null,

    /* Today View Model（画面向け整形データ） */
    todayVM(state) {
      const vm = {
        actionable: [],
        done: [],
        bySlot: {
          1: { actionable: [], done: [] },
          2: { actionable: [], done: [] },
          3: { actionable: [], done: [] },
          4: { actionable: [], done: [] },
        },
      }

      for (const p of state.todayPlanned ?? []) {
        const h = p.h
        if (!h) continue

        const log = p.today_log ?? null
        const slot = h.time_slot ?? null
        const item = { h, log }
        const isDone = log?.status === 'done'

        // ALL モード集計
        ;(isDone ? vm.done : vm.actionable).push(item)

        // slot=1〜4 の場合のみスロット振分
        if (slot && vm.bySlot[slot]) {
          ;(isDone
            ? vm.bySlot[slot].done
            : vm.bySlot[slot].actionable
          ).push(item)
        }
      }

      return vm
    },
  },

  /* ------------------------------------------------------------
   * Actions（API） 
   * ---------------------------------------------------------- */
  actions: {
    /* 今日のデータ取得 */
    async fetchToday() {
      this.loading = true
      try {
        const data = await api.apiFetchToday()

        this.todayDate = data.date
        this.nowSlot   = data.now_slot ?? null
        this.todayPlanned = data.planned ?? []

        // todayLogs（flat logs）
        const logs = []
        for (const p of this.todayPlanned) {
          const l = p.today_log
          if (!l) continue
          logs.push({
            habit_id : p.h.id,
            date     : l.date,
            time_slot: l.time_slot,
            status   : l.status,
            rating   : l.rating,
            updated_at: l.updated_at,
          })
        }
        this.todayLogs = normalizeChecks(logs)

        this.lastFetchedAt = Date.now()
      }
      finally {
        this.loading = false
      }
    },

    /* 週データ */
    async fetchWeeklyBoard(params = {}) {
      this.loading = true
      try {
        const data = await api.apiFetchWeeklyBoard(params)
        this.weekStart    = data.start
        this.weeklyHabits = data.habits ?? []
        this.weeklyChecks = normalizeChecks(data.checks ?? data.logs ?? [])
        this.lastFetchedAt = Date.now()
      }
      finally {
        this.loading = false
      }
    },

    /* ログのトグル（Today） */
    async toggleLog(raw) {
      const payload = {
        habit_id : raw.habit_id ?? raw.id,
        date     : raw.date,
        time_slot: raw.time_slot,
        value    : raw.value ?? null,
        rating   : raw.rating ?? null,
        status   : raw.status ?? null,
      }

      console.log('[toggleLog payload]', payload)

      const res = await api.apiToggleHabitLog(payload)

      if (res.ok) {
        this.todayLogs[makeKey(res.habit_id, res.date, res.time_slot)] = {
          habit_id : res.habit_id,
          date     : res.date,
          time_slot: res.time_slot,
          status   : res.status,
          rating   : res.rating ?? null,
          updated_at: res.updated_at,
        }
      }

      if (this.todayDate) {
        await this.fetchToday()
      }

      return res
    },
  },
})
