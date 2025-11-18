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

/* ========= 操作世代＆保留管理 ========= */
const _opSeq = {}
const nextOpId = (k) => (_opSeq[k] = (_opSeq[k] || 0) + 1)
const isLatest = (k, id) => _opSeq[k] === id

const _pendingByKey = {}
const incPending = (k) => (_pendingByKey[k] = (_pendingByKey[k] || 0) + 1)
const decPending = (k) => {
  if (_pendingByKey[k] > 0) _pendingByKey[k]--
  if (_pendingByKey[k] <= 0) delete _pendingByKey[k]
}

/* ========= auth を安全に取るヘルパ ========= */
function safeAuth() {
  try {
    return useAuthStore()
  } catch {
    return null
  }
}

/* ========= /api/weekly-board ========= */
export async function fetchBoard({ silent = true } = {}) {
  const auth = safeAuth()
  // 認証がまだ確定してない/未ログインなら叩かない
  if (!auth?.fetchedOnce || !auth?.isAuthenticated) {
    return
  }

  if (!silent) state.loading = true

  try {
    const { data } = await axios.get('/api/weekly-board', {
      params: {
        start: isoLocal(startOfWeek(state.start)),
        _t: Date.now(),
      },
    })

    // サーバーが week_start を返してくれたら、それを基準にする
    if (data?.week_start) {
      state.start = startOfWeek(new Date(data.week_start))
    }

    state.habits = (data?.habits ?? []).map((h) => {
      const slotNum = toSlotNum(h.time_slot)
      return { ...h, time_slot: slotNum }
    })

    // 不要になったログを掃除
    const validIds = new Set(state.habits.map((h) => h.id))
    for (const key of Object.keys(state.checks)) {
      const [habitId] = key.split('|')
      if (!validIds.has(Number(habitId))) {
        delete state.checks[key]
      }
    }

    state.lastFetchedAt = Date.now()
    // board を取れたときだけレート再計算
    recomputeRates()
  } catch (e) {
    // 401 は静かに握る（認証タイミングのラグ対策）
    if (e?.response?.status === 401) {
      // noop
    } else {
      console.error('[useHabitBoard] fetchBoard failed', e)
    }
  } finally {
    if (!silent) state.loading = false
  }
}

/* ========= /api/habit-logs/toggle ========= */
export async function toggle(habitId, dateISO, action = 'toggle', slot = 0, rating = null) {
  const auth = safeAuth()
  if (!auth?.isAuthenticated) {
    throw new Error('not authenticated')
  }

  const slotNum = toSlotNum(slot)
  const k = logKey(habitId, dateISO, slotNum)
  const prev =
    state.checks[k] ?? {
      status: 'none',
      rating: 0,
      updated_at: null,
      done: false,
    }
  const opId = nextOpId(k)
  const h = state.habits.find((x) => x.id === habitId)

  let next = {
    ...prev,
    habit_id: habitId,
    date: dateISO,
    time_slot: slotNum,
    updated_at: new Date().toISOString(),
  }

  if (action === 'rating') {
    next.rating = rating
    // self 評価でも simple 評価でも、最終的な done 判定は getLog / normalizeDone に任せる
    next.status = rating >= 4 ? 'done' : 'none'
  } else {
    const wantDone = prev.status !== 'done'
    next.status = wantDone ? 'done' : 'none'
    if (h?.evaluation_type === 'self') {
      next.rating = wantDone ? 4 : 0
    }
  }

  // done フラグは convenience なので、ここでは設定せず OK
  state.checks = { ...state.checks, [k]: next }
  recomputeRates()
  incPending(k)

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
    if (!isLatest(k, opId)) return

    const ratingVal = data?.rating ?? next.rating ?? 0

    // self 評価のときは rating から done/none を決める
    let finalStatus
    if (h?.evaluation_type === 'self') {
      finalStatus = ratingVal >= 4 ? 'done' : 'none'
    } else {
      finalStatus = data?.status === 'done' ? 'done' : 'none'
    }

    state.checks = {
      ...state.checks,
      [k]: {
        habit_id: habitId,
        date: dateISO,
        time_slot: slotNum,
        status: finalStatus,
        rating: ratingVal,
        updated_at: data?.updated_at ?? new Date().toISOString(),
        // done は getLog() 側の normalizeDone で毎回再計算される
      },
    }

    recomputeRates()
  } catch (e) {
    // 401 などで失敗したら元に戻す
    state.checks = { ...state.checks, [k]: prev }
    recomputeRates()
  } finally {
    decPending(k)
  }
}

/* ========= /api/habit-logs (範囲ロード) ========= */
export async function loadLogs(startISO, endISO) {
  const auth = safeAuth()
  if (!auth?.fetchedOnce || !auth?.isAuthenticated) {
    return
  }

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
      let status

      if (h?.evaluation_type === 'self') {
        status = ratingVal >= 4 ? 'done' : 'none'
      } else {
        status = log.status === 'done' ? 'done' : 'none'
      }

      newChecks[key] = {
        habit_id: log.habit_id,
        date: log.date,
        time_slot: slotNum,
        status,
        rating: ratingVal,
        updated_at: log.updated_at ?? null,
        // done は getLog() で normalizeDone される
      }
    }

    state.checks = newChecks
    recomputeRates()
  } catch (e) {
    if (e?.response?.status === 401) {
      // 認証前などは静かに握る
    } else {
      console.error('[useHabitBoard] loadLogs failed', e)
    }
  }
}

/* ========= auth イベントでの自動再取得 ========= */
/**
 * ポイント：
 * - 「今週の開始日」は必ずサーバーの week_start を信じる
 * - そのために、reloadWeek では
 *    1) まず fetchBoard() を叩いて state.start（=week_start）をサーバーに合わせる
 *    2) その state.start〜+6日 を loadLogs() で埋める
 */
export function setupHabitBoardAuthEvents() {
  if (typeof window === 'undefined') return

  const reloadWeek = async () => {
    try {
      // 1) サーバー基準の week_start を取得
      await fetchBoard({ silent: true })

      // 2) 取得した state.start を世界の中心として 1週間分のログを読む
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
    // 他に weekly-board 特有の state を持つようになったらここでリセット
  })
}