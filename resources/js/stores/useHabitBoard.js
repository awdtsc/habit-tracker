// resources/js/stores/useHabitBoard.js
import { reactive } from 'vue'
import axios from '@/axios'                     // ← グローバル設定済みのaxiosを使う
import { toSlotNum as _toSlotNum } from '@/domain/timeutil'
export const toSlotNum = _toSlotNum
import { startOfWeek, addDays, isoLocal } from '@/domain/dates'
import { useAuthStore } from '@/stores/auth'    // ← 認証状態を見る

/* ========= ログキー生成 ========= */
export function logKey (habitId, dateISO, slot = 0) {
  return `${habitId}|${dateISO}|${toSlotNum(slot)}`
}

/* ========= ストア本体 ========= */
const state = reactive({
  start: startOfWeek(new Date()),
  habits: [],
  checks: {},          // { key: {habit_id, date, time_slot, status, rating, updated_at, done} }
  rates: new Array(7).fill(0),
  loading: false,
  saving: false,
  lastFetchedAt: 0,
})

const todayISO = isoLocal(new Date())

/* ========= 操作世代＆保留管理 ========= */
const _opSeq = {}
const nextOpId = k => (_opSeq[k] = (_opSeq[k] || 0) + 1)
const isLatest = (k, id) => _opSeq[k] === id

const _pendingByKey = {}
const incPending = k => (_pendingByKey[k] = (_pendingByKey[k] || 0) + 1)
const decPending = k => {
  if (_pendingByKey[k] > 0) _pendingByKey[k]--
  if (_pendingByKey[k] <= 0) delete _pendingByKey[k]
}

/* ========= スケジュール判定 ========= */
function isScheduledFor (h, dateISO) {
  if (h?.start_date && dateISO < h.start_date) return false
  if (h?.end_date && dateISO > h.end_date) return false

  const dt = new Date(dateISO + 'T00:00:00')
  const dow = ((dt.getDay() + 6) % 7) + 1 // 1=Mon ... 7=Sun

  switch (h?.frequency_type) {
    case 'daily':     return true
    case 'weekdays':  return dow >= 1 && dow <= 5
    case 'weekends':  return dow === 6 || dow === 7
    case 'custom':
    case 'weekly':
      return Array.isArray(h?.days_of_week) && h.days_of_week.map(Number).includes(dow)
    case 'quota':
    default:
      return true
  }
}

/* ========= 完了判定 ========= */
function normalizeDone (h, log) {
  if (!log) return false
  if (h?.evaluation_type === 'self') {
    return (log.rating ?? 0) >= 4
  }
  return log.status === 'done'
}

function isDone (habitId, dateISO, slot = 0) {
  const h = state.habits.find(x => x.id === habitId)
  const k = logKey(habitId, dateISO, toSlotNum(slot))
  const log = state.checks[k]
  return normalizeDone(h, log)
}

/* ========= 週グラフ再計算 ========= */
function recomputeRates () {
  const arr = new Array(7).fill(0)
  for (let i = 0; i < 7; i++) {
    const dateISO = isoLocal(addDays(state.start, i))
    const planned = state.habits.filter(h => isScheduledFor(h, dateISO))
    const den = planned.length
    if (!den) { arr[i] = 0; continue }

    let num = 0
    for (const h of planned) {
      const slotNum = toSlotNum(h.time_slot)
      const log = state.checks[logKey(h.id, dateISO, slotNum)]
      if (normalizeDone(h, log)) num++
    }
    arr[i] = Math.round(num / den * 100)
  }
  state.rates = arr
  state.lastFetchedAt = Date.now()
}

/* ========= fetchBoard ========= */
async function fetchBoard ({ silent = true } = {}) {
  const auth = safeAuth()
  // 🔒 認証がまだ確定してない/未ログインなら叩かない
  if (!auth?.fetchedOnce || !auth?.isAuthenticated) {
    // console.info('[useHabitBoard] fetchBoard skipped (auth not ready)')
    return
  }

  if (!silent) state.loading = true
  try {
    const { data } = await axios.get('/api/weekly-board', {
      params: { start: isoLocal(startOfWeek(state.start)), _t: Date.now() },
    })

    if (data?.week_start) {
      state.start = startOfWeek(new Date(data.week_start))
    }

    state.habits = (data?.habits ?? []).map(h => {
      const slotNum = toSlotNum(h.time_slot)
      return { ...h, time_slot: slotNum }
    })

    // 不要になったログを掃除
    const validIds = new Set(state.habits.map(h => h.id))
    for (const key of Object.keys(state.checks)) {
      const [habitId] = key.split('|')
      if (!validIds.has(Number(habitId))) delete state.checks[key]
    }

    state.lastFetchedAt = Date.now()
    // boardを取れたときだけレート再計算
    recomputeRates()
  } catch (e) {
    // 401は静かに握る（認証タイミングのラグ対策）
    if (e?.response?.status === 401) {
      // console.info('[useHabitBoard] fetchBoard 401 (probably session not attached yet)')
    } else {
      console.error('[useHabitBoard] fetchBoard failed', e)
    }
  } finally {
    if (!silent) state.loading = false
  }
}

/* ========= toggle ========= */
async function toggle (habitId, dateISO, action = 'toggle', slot = 0, rating = null) {
  const auth = safeAuth()
  if (!auth?.isAuthenticated) {
    throw new Error('not authenticated')
  }

  const slotNum = toSlotNum(slot)
  const k = logKey(habitId, dateISO, slotNum)
  const prev = state.checks[k] ?? { status: 'none', rating: 0, updated_at: null, done: false }
  const opId = nextOpId(k)
  const h = state.habits.find(x => x.id === habitId)

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
  next.done = normalizeDone(h, next)

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
    let finalStatus = (h?.evaluation_type === 'self')
      ? (ratingVal >= 4 ? 'done' : 'none')
      : (data?.status === 'done' ? 'done' : 'none')

    state.checks = {
      ...state.checks,
      [k]: {
        habit_id: habitId,
        date: dateISO,
        time_slot: slotNum,
        status: finalStatus,
        rating: ratingVal,
        updated_at: data?.updated_at ?? new Date().toISOString(),
        done: normalizeDone(h, { status: finalStatus, rating: ratingVal }),
      },
    }

    recomputeRates()
  } catch (e) {
    // 401などで失敗したら元に戻す
    state.checks = { ...state.checks, [k]: prev }
    recomputeRates()
  } finally {
    decPending(k)
  }
}

/* ========= loadLogs ========= */
async function loadLogs (startISO, endISO) {
  const auth = safeAuth()
  if (!auth?.fetchedOnce || !auth?.isAuthenticated) {
    return
  }

  try {
    const { data } = await axios.get('/api/habit-logs', {
      params: { start: startISO, end: endISO },
    })
    const newChecks = { ...state.checks }
    for (const log of (data?.logs ?? [])) {
      const slotNum = toSlotNum(log.time_slot)
      const key = logKey(log.habit_id, log.date, slotNum)
      const h = state.habits.find(x => x.id === log.habit_id)

      const ratingVal = log.rating ?? 0
      const status = (h?.evaluation_type === 'self')
        ? (ratingVal >= 4 ? 'done' : 'none')
        : (log.status === 'done' ? 'done' : 'none')

      newChecks[key] = {
        habit_id: log.habit_id,
        date: log.date,
        time_slot: slotNum,
        status,
        rating: ratingVal,
        updated_at: log.updated_at ?? null,
        done: normalizeDone(h, { status, rating: ratingVal }),
      }
    }
    state.checks = newChecks
    recomputeRates()
  } catch (e) {
    if (e?.response?.status === 401) {
      // console.info('[useHabitBoard] loadLogs 401 (auth not ready)')
    } else {
      console.error('[useHabitBoard] loadLogs failed', e)
    }
  }
}

/* ========= 正規化取得 ========= */
function getLog (habitId, dateISO, slot = 0) {
  const k = logKey(habitId, dateISO, toSlotNum(slot))
  const base = state.checks[k]
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

  const h = state.habits.find(x => x.id === habitId)
  const ratingVal = base.rating ?? 0
  const status = base.status
  const done = normalizeDone(h, base)

  return {
    ...base,
    habit_id: habitId,
    date: dateISO,
    time_slot: slot,
    status,
    rating: ratingVal,
    done,
  }
}

/* ========= auth を安全に取るヘルパ ========= */
function safeAuth () {
  try {
    return useAuthStore()
  } catch {
    return null
  }
}

/* ========= ブラウザイベントで自動再取得 ========= */
// ログインが終わったら現在週を読み直す
if (typeof window !== 'undefined') {
  const reloadWeek = () => {
    const start = isoLocal(startOfWeek(new Date()))
    const end = isoLocal(addDays(startOfWeek(new Date()), 6))
    fetchBoard({ silent: true })
      .then(() => loadLogs(start, end))
      .catch(() => {})
  }

  window.addEventListener('auth:ready', reloadWeek)
  window.addEventListener('auth:logged-in', reloadWeek)

  window.addEventListener('auth:logged-out', () => {
    state.habits = []
    state.checks = {}
    state.rates = new Array(7).fill(0)
  })
}

/* ========= export ========= */
export function useHabitBoard () {
  return {
    state,
    todayISO,
    fetchBoard,
    toggle,
    recomputeRates,
    loadLogs,
    getLog,
    isScheduledFor,
    logKey,
    isDone,
  }
}
