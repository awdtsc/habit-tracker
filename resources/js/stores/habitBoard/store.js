// resources/js/stores/habitBoard/store.js
//------------------------------------------------------------
// HabitBoard Store v3（Today / Weekly / ToggleLog）
//   - API の生データだけ保持
//   - TodayVM を store 側で組み立てる（View Model）
//------------------------------------------------------------

import { defineStore } from 'pinia'
import * as api from './api.js'
import { buildTodayViewModel } from './selectors'
import { toSlotNum } from '@/domain/timeutil'

/* ------------------------------------------------------------
 * 共通ユーティリティ
 * ---------------------------------------------------------- */
const makeKey = (id, date, slot) => `${id}_${date}_${slot}`
const keyFor = (id, date, slot) => makeKey(Number(id), date, toSlotNum(slot))

const normalizeChecks = (logs = []) => {
  const out = {}
  for (const log of logs) {
    const key = keyFor(log.habit_id, log.date, log.time_slot)
    out[key] = { ...log, time_slot: toSlotNum(log.time_slot) }
  }
  return out
}

const emptyView = () => ({
  items: [],
  actionable: [],
  done: [],
  bySlot: { 0: [], 1: [], 2: [], 3: [], 4: [] },
  progress: { total: 0, completed: 0, done: 0, rate: 0 },
  nextSlot: null,
  topPick: null,
})

const normalizeLog = (raw, ctx = {}) => {
  if (!raw) return null
  const habitId = Number(raw.habit_id ?? ctx.habit_id)
  const date     = raw.date ?? ctx.date
  if (!habitId || !date) return null

  const slot = toSlotNum(raw.time_slot ?? ctx.time_slot ?? 0)
  const status = raw.status ?? (raw.value ? 'done' : 'none')

  return {
    habit_id : habitId,
    date,
    time_slot: slot,
    status,
    rating   : raw.rating ?? null,
    value    : raw.value ?? null,
    updated_at: raw.updated_at ?? raw.checked_at ?? null,
  }
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
    todayView: emptyView(),
    todayLoaded: false,

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
      state.todayLogs[keyFor(id, date, slot)] || null,

    /* Today View Model（画面向け整形データ） */
    todayVM(state) {
      return state.todayView
    },
  },

  /* ------------------------------------------------------------
   * Actions（API） 
   * ---------------------------------------------------------- */
  actions: {
    applyLogUpdate(log) {
      if (!log) return

      this.todayLogs[keyFor(log.habit_id, log.date, log.time_slot)] = log

      const idx = this.todayPlanned.findIndex(p => Number(p?.h?.id) === log.habit_id)
      if (idx >= 0) {
        const row = this.todayPlanned[idx]
        const updatedHabit = { ...row.h, time_slot: toSlotNum(row?.h?.time_slot ?? log.time_slot) }
        this.todayPlanned.splice(idx, 1, {
          ...row,
          h: updatedHabit,
          today_log: log,
        })
      }
    },

    /* 今日のデータ取得 */
    async fetchToday() {
      this.loading = true
      try {
        const data = await api.apiFetchToday()

        this.todayDate = data.date
        this.nowSlot   = toSlotNum(data.now_slot ?? data.current_slot ?? null) || null

        this.todayPlanned = (data.planned ?? []).map(p => {
          const slot = toSlotNum(p?.h?.time_slot ?? p?.today_log?.time_slot ?? 0)
          const log  = normalizeLog(p.today_log, { habit_id: p?.h?.id, date: data.date, time_slot: slot })
          return {
            ...p,
            h: { ...p.h, time_slot: slot },
            today_log: log,
          }
        })

        const logs = []
        for (const p of this.todayPlanned) {
          if (p.today_log) logs.push(p.today_log)
        }
        this.todayLogs = normalizeChecks(logs)

        this.rebuildTodayView()
        this.todayLoaded = true
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
    rebuildTodayView() {
      this.todayView = buildTodayViewModel({
        planned: this.todayPlanned,
        getLog: this.getLog,
        date: this.todayDate,
        nowSlot: this.nowSlot,
      })
    },

    async toggleLog(raw) {
      const payload = {
        habit_id : raw.habit_id ?? raw.id,
        date     : raw.date ?? this.todayDate,
        time_slot: raw.time_slot,
        value    : raw.value ?? null,
        rating   : raw.rating ?? null,
        status   : raw.status ?? null,
      }

      // 即時反映（オプティミスティック）
      const optimistic = normalizeLog({ ...payload, updated_at: new Date().toISOString() }, payload)
      if (optimistic) {
        this.applyLogUpdate(optimistic)
        this.rebuildTodayView()
      }

      const res = await api.apiToggleHabitLog(payload)

      const log = normalizeLog(res, payload)
      if (log) {
        this.applyLogUpdate(log)
        this.rebuildTodayView()
      }

      return res
    },
  },
})
