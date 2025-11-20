// resources/js/stores/useHabitBoardActions.js
import axios from '@/axios'
import { addDays, isoLocal, startOfWeek } from '@/domain/dates'
import { useAuthStore } from '@/stores/auth'

import {
  state,
  toSlotNum,
  logKey,
  recomputeRates,
} from './useHabitBoardCore'

/* =========================================================
 * 操作世代（op-seq）と pending 管理
 * ======================================================= */
const _opSeq = {}
const nextOpId = (k) => (_opSeq[k] = (_opSeq[k] || 0) + 1)
const isLatest = (k, id) => _opSeq[k] === id

const _pendingByKey = {}
const incPending = (k) => (_pendingByKey[k] = (_pendingByKey[k] || 0) + 1)
const decPending = (k) => {
  if (_pendingByKey[k] > 0) _pendingByKey[k]--
  if (_pendingByKey[k] <= 0) delete _pendingByKey[k]
}

/* =========================================================
 * 安全な auth 取得
 * ======================================================= */
function safeAuth() {
  try {
    return useAuthStore()
  } catch {
    return null
  }
}

/* =========================================================
 * /api/weekly-board
 * ======================================================= */
export async function fetchBoard({ silent = true } = {}) {
  const auth = safeAuth()
  if (!auth?.isAuthenticated) return   // ← ★修正点: fetchedOnce 削除

  if (!silent) state.loading = true

  try {
    const { data } = await axios.get('/api/weekly-board', {
      params: {
        start: isoLocal(startOfWeek(state.start)),
        _t: Date.now(),
      },
    })

    // サーバーの week_start を優先
    if (data?.week_start) {
      state.start = startOfWeek(new Date(data.week_start))
    }

    // 習慣ロード
    state.habits = (data?.habits ?? []).map((h) => ({
      ...h,
      time_slot: toSlotNum(h.time_slot),
    }))

    // 古い habit_id のログ掃除
    const valid = new Set(state.habits.map((h) => h.id))
    for (const key of Object.keys(state.checks)) {
      const [habitId] = key.split('|')
      if (!valid.has(Number(habitId))) delete state.checks[key]
    }

    state.lastFetchedAt = Date.now()
    recomputeRates()
  } catch (e) {
    if (e?.response?.status !== 401) {
      console.error('[useHabitBoard] fetchBoard failed', e)
    }
  } finally {
    if (!silent) state.loading = false
  }
}

/* =========================================================
 * /api/habit-logs/toggle（差分返し版）
 * ======================================================= */
export async function toggle(
  habitId,
  dateISO,
  action = 'toggle',
  slot = 0,
  rating = null
) {
  const auth = safeAuth()
  if (!auth?.isAuthenticated) throw new Error('not authenticated')

  const slotNum = toSlotNum(slot)
  const k = logKey(habitId, dateISO, slotNum)
  const prev =
    state.checks[k] ?? {
      status: 'none',
      rating: 0,
      updated_at: null,
    }

  const opId = nextOpId(k)
  const h = state.habits.find((x) => x.id === habitId)

  /* ---------- 1) 楽観的更新 ---------- */
  let next = {
    ...prev,
    habit_id: habitId,
    date: dateISO,
    time_slot: slotNum,
    updated_at: new Date().toISOString(),
  }

  if (action === 'rating') {
    next.rating = rating
    next.status = rating >= 4 ? 'done' : 'none'
  } else {
    const wantDone = prev.status !== 'done'
    next.status = wantDone ? 'done' : 'none'
    if (h?.evaluation_type === 'self') {
      next.rating = wantDone ? 4 : 0
    }
  }

  // 即時ローカル反映
  state.checks = { ...state.checks, [k]: next }
  recomputeRates()
  incPending(k)

  /* ---------- 2) API 反映 ---------- */
  try {
    const payload = {
      habit_id: habitId,
      date: dateISO,
      time_slot: slotNum,
      rating: next.rating,
      status: next.status,
      action,
    }

    const { data } = await axios.post('/api/habit-logs/toggle', payload)

    // 古い操作なら何もしない
    if (!isLatest(k, opId)) return null

    const ratingVal = data?.rating ?? next.rating
    const finalStatus =
      h?.evaluation_type === 'self'
        ? ratingVal >= 4 ? 'done' : 'none'
        : data?.status === 'done' ? 'done' : 'none'

    const updated = {
      habit_id: habitId,
      date: dateISO,
      time_slot: slotNum,
      status: finalStatus,
      rating: ratingVal,
      updated_at: data?.updated_at ?? new Date().toISOString(),
    }

    // サーバー確定反映
    state.checks = { ...state.checks, [k]: updated }
    recomputeRates()

    return updated
  } catch (e) {
    // revert
    state.checks = { ...state.checks, [k]: prev }
    recomputeRates()
    return null
  } finally {
    decPending(k)
  }
}

/* =========================================================
 * /api/habit-logs （範囲ロード）
 * ======================================================= */
export async function loadLogs(startISO, endISO) {
  const auth = safeAuth()
  if (!auth?.isAuthenticated) return   // ← ★修正点: fetchedOnce 削除

  try {
    const { data } = await axios.get('/api/habit-logs', {
      params: { start: startISO, end: endISO },
    })

    const newChecks = { ...state.checks }

    for (const log of data?.logs ?? []) {
      const slotNum = toSlotNum(log.time_slot)
      const key = logKey(log.habit_id, log.date, slotNum)
      const h = state.habits.find((x) => x.id === log.habit_id)

      const ratingVal = log.rating ?? 0
      const status =
        h?.evaluation_type === 'self'
          ? ratingVal >= 4 ? 'done' : 'none'
          : log.status === 'done' ? 'done' : 'none'

      newChecks[key] = {
        habit_id: log.habit_id,
        date: log.date,
        time_slot: slotNum,
        status,
        rating: ratingVal,
        updated_at: log.updated_at ?? null,
      }
    }

    state.checks = newChecks
    recomputeRates()
  } catch (e) {
    if (e?.response?.status !== 401) {
      console.error('[useHabitBoard] loadLogs failed', e)
    }
  }
}

/* =========================================================
 * 認証イベントで週データ自動取得
 * ======================================================= */
export function setupHabitBoardAuthEvents() {
  if (typeof window === 'undefined') return

  const reloadWeek = async () => {
    try {
      await fetchBoard({ silent: true })

      const startISO = isoLocal(state.start)
      const endISO = isoLocal(addDays(state.start, 6))

      await loadLogs(startISO, endISO)
    } catch (e) {
      console.error('[useHabitBoard] reloadWeek failed', e)
    }
  }

  window.addEventListener('auth:ready', reloadWeek)
  window.addEventListener('auth:logged-in', reloadWeek)

  window.addEventListener('auth:logged-out', () => {
    state.habits = []
    state.checks = {}
    state.rates = new Array(7).fill(0)
  })
}