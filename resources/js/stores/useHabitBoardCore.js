// resources/js/stores/useHabitBoardCore.js
import { reactive, ref } from 'vue'
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
 * checks（唯一のリアクティブ Source）
 * ============================ */
const checksRef = ref({})

export const state = reactive({
  start: startOfWeek(new Date()),  // Week表示開始日
  habits: [],

  // checksRef に完全依存
  get checks() {
    return checksRef.value
  },
  set checks(v) {
    // 必ず新しいオブジェクトとして再割当
    checksRef.value = { ...(v || {}) }
  },

  rates: new Array(7).fill(0), // 週グラフ（%）
  loading: false,
  saving: false,
  lastFetchedAt: 0,
})

export function replaceChecks(next) {
  // フロント全域で使う checks 更新はこれに一本化
  state.checks = next
}

export const todayISO = isoLocal(new Date())

/* ============================
 * スケジュール判定（fallback）
 * ============================ */
export function isScheduledFor(h, dateISO) {
  if (!h) return false
  if (h.start_date && dateISO < h.start_date) return false
  if (h.end_date && dateISO > h.end_date) return false

  const dt = new Date(dateISO + 'T00:00:00')
  const dow = ((dt.getDay() + 6) % 7) + 1 // Mon=1 ... Sun=7

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
      return true
    default:
      return true
  }
}

/* ============================
 * 完了判定（server logic と整合）
 * ============================ */
export function normalizeDone(h, log) {
  if (!h || !log) return false

  if (h.evaluation_type === 'self') {
    return (log.rating ?? 0) >= 4
  }
  return log.status === 'done'
}

export function isDone(habitId, dateISO, slot = 0) {
  const h = state.habits.find((x) => x.id === habitId)
  if (!h) return false

  const k = logKey(habitId, dateISO, slot)
  const log = state.checks[k]

  return normalizeDone(h, log)
}

/* ============================
 * 週グラフ再計算（AGAIN）
 * ANYTIME（time_slot=0）を除外
 * ============================ */
export function recomputeRates() {
  const newRates = new Array(7).fill(0)

  if (!state.habits.length) {
    state.rates = newRates
    return
  }

  for (let i = 0; i < 7; i++) {
    const dateISO = isoLocal(addDays(state.start, i))

    // ANYTIME（slot=0）を除外（仕様：達成率に含めない）
    const planned = state.habits.filter(h => {
      const s = toSlotNum(h.time_slot)
      if (s === 0) return false // ← ★いつでも除外
      return isScheduledFor(h, dateISO)
    })

    const den = planned.length
    if (den === 0) {
      newRates[i] = 0
      continue
    }

    let num = 0
    for (const h of planned) {
      const slotNum = toSlotNum(h.time_slot)
      const key = logKey(h.id, dateISO, slotNum)
      const log = state.checks[key]
      if (normalizeDone(h, log)) num++
    }

    newRates[i] = Math.round((num / den) * 100)
  }

  state.rates = newRates
  state.lastFetchedAt = Date.now()
}

/* ============================
 * getLog（正規化ログ）
 * ============================ */
export function getLog(habitId, dateISO, slot = 0) {
  const key = logKey(habitId, dateISO, slot)
  const base = state.checks[key]
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
