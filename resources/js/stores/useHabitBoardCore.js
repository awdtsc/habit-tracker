// resources/js/stores/useHabitBoardCore.js
import { reactive } from 'vue'
import { toSlotNum as _toSlotNum } from '@/domain/timeutil'
import { startOfWeek, addDays, isoLocal } from '@/domain/dates'
import { useAuthStore } from '@/stores/auth'

/* ============================
 * 公開ユーティリティ
 * ============================ */
export const toSlotNum = _toSlotNum

export function logKey(habitId, dateISO, slot = 0) {
  return `${habitId}|${dateISO}|${toSlotNum(slot)}`
}

/* ============================
 * 単一ストア（唯一の source-of-truth）
 * ============================ */
export const state = reactive({
  start: startOfWeek(new Date()), // Weekタブ開始日（後で /api/weekly-board の week_start で上書きされる）
  habits: [],                     // サーバー /api/weekly-board の habits
  checks: {},                     // { key → { habit_id, date, time_slot, status, rating, updated_at, done } }
  rates: new Array(7).fill(0),    // 日別達成率 [%]
  loading: false,
  saving: false,
  lastFetchedAt: 0,
})

export const todayISO = isoLocal(new Date()) // クライアントに依存しないための ISO（Today で使用）


/* ============================
 * スケジュール判定（front-only fallback）
 *
 * ⚠️ サーバーに合わせるべき。将来的には殺す前提。
 *    /api/weekly-board の scheduled_by_date を使うと完全同一になる。
 * ============================ */
export function isScheduledFor(h, dateISO) {
  if (!h) return false

  if (h.start_date && dateISO < h.start_date) return false
  if (h.end_date && dateISO > h.end_date) return false

  const dt = new Date(dateISO + 'T00:00:00')
  const dow = ((dt.getDay() + 6) % 7) + 1 // 1=Mon ... 7=Sun

  switch (h.frequency_type) {
    case 'daily':
      return true

    case 'weekdays':
      return dow >= 1 && dow <= 5

    case 'weekends':
      return dow === 6 || dow === 7

    case 'custom':
    case 'weekly':
      return Array.isArray(h.days_of_week) &&
             h.days_of_week.map(Number).includes(dow)

    case 'quota':
      // quota はサーバーでも "毎日は対象" 扱いなので true
      return true

    default:
      return true
  }
}


/* ============================
 * 完了判定（server logic と完全整合）
 * ============================ */
export function normalizeDone(h, log) {
  if (!h || !log) return false

  if (h.evaluation_type === 'self') {
    return (log.rating ?? 0) >= 4
  }

  return log.status === 'done'
}

export function isDone(habitId, dateISO, slot = 0) {
  const h = state.habits.find(x => x.id === habitId)
  if (!h) return false

  const k = logKey(habitId, dateISO, slot)
  const log = state.checks[k]

  return normalizeDone(h, log)
}


/* ============================
 * 週グラフ再計算（フロント暫定版）
 *
 * ⚠️ 将来的には /api/weekly-board の rates をそのまま使う。
 * ============================ */
export function recomputeRates() {
  // 前回の rates を誤って残さない
  const newRates = new Array(7).fill(0)

  if (!state.habits.length) {
    state.rates = newRates
    return
  }

  for (let i = 0; i < 7; i++) {
    const dateISO = isoLocal(addDays(state.start, i))

    const planned = state.habits.filter(h => isScheduledFor(h, dateISO))
    const den = planned.length

    if (den === 0) {
      newRates[i] = 0
      continue
    }

    let num = 0
    for (const h of planned) {
      const slotNum = toSlotNum(h.time_slot)
      const k = logKey(h.id, dateISO, slotNum)
      const log = state.checks[k]

      if (normalizeDone(h, log)) num++
    }

    newRates[i] = Math.round((num / den) * 100)
  }

  state.rates = newRates
  state.lastFetchedAt = Date.now()
}


/* ============================
 * 正規化取得（状態一括返却）
 * ============================ */
export function getLog(habitId, dateISO, slot = 0) {
  const k = logKey(habitId, dateISO, slot)
  const base = state.checks[k]
  const h = state.habits.find(x => x.id === habitId)

  if (!base) {
    return {
      habit_id: habitId,
      date: dateISO,
      time_slot: slot,
      status: 'none',
      rating: 0,
      updated_at: null,
      done: false,
    }
  }

  return {
    ...base,
    habit_id: habitId,
    date: dateISO,
    time_slot: slot,
    rating: base.rating ?? 0,
    status: base.status ?? 'none',
    done: normalizeDone(h, base),
  }
}


/* ============================
 * Auth（安全取得）
 * ============================ */
export function safeAuth() {
  try {
    return useAuthStore()
  } catch {
    return null
  }
}