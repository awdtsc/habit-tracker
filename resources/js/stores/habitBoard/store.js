// resources/js/stores/habitBoard/store.js
//------------------------------------------------------------
// HabitBoard Store v3（Today / Weekly / ToggleLog）
//------------------------------------------------------------

import { defineStore } from 'pinia'
import * as api from './api.js'
import { buildTodayViewModel } from './selectors'
import { toSlotNum } from '@/domain/timeutil'

/* ------------------------------------------------------------
 * Helpers
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
  const date = raw.date ?? ctx.date
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
 * STORE
 * ---------------------------------------------------------- */
export const useHabitBoardStore = defineStore('habitBoard', {

  state: () => ({
    todayDate: null,
    nowSlot: null,
    todayPlanned: [],
    todayLogs: {},
    todayView: emptyView(),
    todayLoaded: false,

    weekStart: null,
    weeklyHabits: [],
    weeklyChecks: {},

    loading: false,
    lastFetchedAt: null,
  }),

  getters: {
    getLog: (state) => (id, date, slot) =>
      state.todayLogs[keyFor(id, date, slot)] || null,

    todayVM(state) {
      return state.todayView
    },
  },

  actions: {

    //--------------------------------------------------------
    // applyLogUpdate（ログ1件反映）
    //--------------------------------------------------------
    applyLogUpdate(log) {
      console.log('[STORE] applyLogUpdate', log)
      if (!log) return

      this.todayLogs[keyFor(log.habit_id, log.date, log.time_slot)] = log

      const idx = this.todayPlanned.findIndex(
        p => Number(p?.h?.id) === log.habit_id
      )

      if (idx >= 0) {
        const row = this.todayPlanned[idx]
        const updatedHabit = {
          ...row.h,
          time_slot: toSlotNum(row?.h?.time_slot ?? log.time_slot),
        }

        this.todayPlanned.splice(idx, 1, {
          ...row,
          h: updatedHabit,
          today_log: log,
        })
      }
    },

    //--------------------------------------------------------
    // fetchToday
    //--------------------------------------------------------
    async fetchToday() {
      console.log('[STORE] fetchToday start')
      this.loading = true
      try {
        const data = await api.apiFetchToday()
        console.log('[STORE] fetchToday API result', data)

        this.todayDate = data.date
        this.nowSlot = toSlotNum(data.now_slot ?? data.current_slot ?? null) || null

        this.todayPlanned = (data.planned ?? []).map(p => {
          const slot = toSlotNum(
            p?.h?.time_slot ?? p?.today_log?.time_slot ?? 0
          )
          const log = normalizeLog(p.today_log, {
            habit_id: p?.h?.id,
            date: data.date,
            time_slot: slot,
          })
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

    //--------------------------------------------------------
    // rebuildTodayView
    //--------------------------------------------------------
    rebuildTodayView() {
      console.log('[STORE] rebuildTodayView')

      const vm = buildTodayViewModel({
        planned: this.todayPlanned,
        getLog: this.getLog,
        date: this.todayDate,
        nowSlot: this.nowSlot,
      })

      // ❗ オブジェクトごと置き換えない（重い）
      // this.todayView = vm

      // ✔ 部分更新のみ（高速）
      Object.assign(this.todayView, vm)

      console.log('[STORE] todayView = ', this.todayView)
    },


    //--------------------------------------------------------
    // toggleLog（完了/未完）
    //--------------------------------------------------------
    async toggleLog(raw) {
      console.log('[STORE] toggleLog called, raw =', raw)

      // ⚠ simple の場合は value を送らない
      // self の場合（rating > 0 のときだけ送る）
      let payload = {
        habit_id : raw.habit_id ?? raw.id,
        date     : raw.date ?? this.todayDate,
        time_slot: raw.time_slot,
      }

      if (raw.evaluation_type === 'self') {
        if (raw.rating != null) payload.rating = raw.rating
        if (raw.value != null)  payload.value  = raw.value
      }

      console.log('[STORE] toggle payload', payload)

      //----------------------------------------------------
      // Optimistic Update
      //----------------------------------------------------
      const optimistic = normalizeLog(
        { ...payload, updated_at: new Date().toISOString() },
        payload
      )

      if (optimistic) {
        console.log('[STORE] optimistic applied')
        this.applyLogUpdate(optimistic)
      }

      //----------------------------------------------------
      // API request
      //----------------------------------------------------
      let res
      try {
        res = await api.apiToggleHabitLog(payload)
        console.log('[STORE] API response', res)
      } catch (e) {
        console.error('[STORE] API ERROR', e)
        return
      }

      //----------------------------------------------------
      // Confirmed update
      //----------------------------------------------------
      const log = normalizeLog(res, payload)
      if (log) {
        console.log('[STORE] confirmed log applied', log)
        this.applyLogUpdate(log)
      }

      //----------------------------------------------------
      // ViewModel 再構築
      //----------------------------------------------------
      this.rebuildTodayView()

      return res
    },
  },
})