// resources/js/stores/useHabitBoard.js
import { reactive } from 'vue'
import axios from 'axios'

/* ---- 日付ユーティリティ ---- */
function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const w = d.getDay() || 7
  if (w !== 1) d.setDate(d.getDate() - (w - 1))
  return d
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function isoLocal(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}

/* ---- ストア本体 ---- */
const SNAP_KEY = '__board_snapshot__'
const LOCAL_WIN_MS = 1500 // 再同期での巻き戻り防止：直近1.5sはローカル優先

const state = reactive({
  start: startOfWeek(new Date()),
  habits: [],
  checks: {},                 // {'habitId|yyyy-mm-dd': true/false}
  rates: new Array(7).fill(0),
  loading: false,
  saving: false,
  lastFetchedAt: 0,
})

const todayISO = isoLocal(new Date())

/* ---- 操作世代＆保留管理 ---- */
const _opSeq = {}                                // {'k': seq}
const nextOpId = k => (_opSeq[k] = (_opSeq[k] || 0) + 1)
const isLatest = (k, id) => _opSeq[k] === id

const _touchedAt = {}                             // {'k': ts} … 直近タッチ
const markTouched = k => { _touchedAt[k] = Date.now() }

const _pendingByKey = {}                          // {'k': count} … 送信保留中
const incPending = k => (_pendingByKey[k] = (_pendingByKey[k] || 0) + 1)
const decPending = k => {
  if (_pendingByKey[k] > 0) _pendingByKey[k]--
  if (_pendingByKey[k] <= 0) delete _pendingByKey[k]
}

/* ---- 「全完了後に1回だけ再同期」 ---- */
let _activeRequests = 0
let _reconcileTimer
function scheduleReconcileAfterAll() {
  clearTimeout(_reconcileTimer)
  if (_activeRequests > 0) return
  _reconcileTimer = setTimeout(() => {
    fetchBoard({ silent: true })                 // サイレント同期（UIを揺らさない）
  }, 600)                                        // DB反映遅延に強く
}

/* その日が実施対象か？ */
function isScheduledFor(habit, dateISO) {
  if (habit?.start_date && dateISO < habit.start_date) return false
  if (habit?.end_date   && dateISO > habit.end_date)   return false
  const dt = new Date(dateISO)
  const dow = ((dt.getDay() + 6) % 7) + 1
  switch (habit?.frequency_type) {
    case 'daily':    return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekends': return dow === 6 || dow === 7
    case 'custom':   return Array.isArray(habit?.days_of_week)
                       && habit.days_of_week.map(Number).includes(dow)
    case 'quota':    return true
    default:         return true
  }
}

/* 週グラフ再計算 */
function recomputeRates() {
  const s = startOfWeek(state.start)
  const next = new Array(7).fill(0)
  for (let i = 0; i < 7; i++) {
    const dateISO = isoLocal(addDays(s, i))
    const planned = state.habits.filter(h => isScheduledFor(h, dateISO))
    const den = planned.length
    if (!den) { next[i] = 0; continue }
    const num = planned.reduce((acc, h) => acc + (state.checks[`${h.id}|${dateISO}`] ? 1 : 0), 0)
    next[i] = Math.round((num * 100) / den)
  }
  state.rates = next
}

/* ---- スナップショット ---- */
function saveSnapshot() {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify({
      start: isoLocal(startOfWeek(state.start)),
      habits: state.habits,
      checks: state.checks,
      rates: state.rates,
      ts: Date.now(),
    }))
  } catch {}
}
function hydrateFromSnapshot() {
  try {
    const raw = localStorage.getItem(SNAP_KEY)
    if (!raw) return false
    const snap = JSON.parse(raw)
    if (snap.start) state.start = startOfWeek(new Date(snap.start))
    state.habits = Array.isArray(snap.habits) ? snap.habits : []
    state.checks = snap.checks || {}
    state.rates  = Array.isArray(snap.rates) && snap.rates.length === 7 ? snap.rates : state.rates
    state.lastFetchedAt = snap.ts || 0
    return true
  } catch { return false }
}

/* ---- 鮮度判定 & フェッチ ---- */
function isFresh(ms = 60_000) {
  return Date.now() - state.lastFetchedAt < ms
}

async function fetchBoard({ silent = true } = {}) {
  if (!silent) state.loading = true
  try {
    const { data } = await axios.get('/api/weekly-board', {
      params: { start: isoLocal(startOfWeek(state.start)), _t: Date.now() }
    })
    if (data?.week_start) state.start = startOfWeek(new Date(data.week_start))
    state.habits = data?.habits ?? []

    // サーバの checks
    const server = {}
    ;(data?.checks ?? []).forEach(r => { server[`${r.habit_id}|${r.date}`] = !!r.value })

    // ▼ マージポリシー：
    //   1) そのキーが「保留中 or 直近触った(LOCAL_WIN_MS以内)」ならローカル優先
    //   2) それ以外はサーバ優先
    const now = Date.now()
    const merged = { ...server }
    // ローカルにしか無いキーも保護
    for (const k of new Set([...Object.keys(server), ...Object.keys(state.checks)])) {
      const pending = (_pendingByKey[k] || 0) > 0
      const recent  = (now - (_touchedAt[k] || 0)) < LOCAL_WIN_MS
      if ((pending || recent) && k in state.checks) {
        merged[k] = state.checks[k]
      }
      // 期限切れは掃除
      if (!pending && (now - (_touchedAt[k] || 0)) >= LOCAL_WIN_MS) {
        delete _touchedAt[k]
      }
    }
    state.checks = merged

    recomputeRates()
    state.lastFetchedAt = Date.now()
    saveSnapshot()
  } finally {
    if (!silent) state.loading = false
  }
}

/* ---- トグル ---- */
function normalizeStatus(s, fallback) {
  if (s === true || s === 'checked' || s === 1) return true
  if (s === false || s === 'unchecked' || s === 0) return false
  return !!fallback
}

async function toggle(habitId, dateISO, value) {
  const k = `${habitId}|${dateISO}`
  const prev = !!state.checks[k]
  const desired = !!value
  const opId = nextOpId(k)

  // 楽観反映（即表示）
  state.checks = { ...state.checks, [k]: desired }
  recomputeRates()
  saveSnapshot?.()
  markTouched(k)
  incPending(k)

  try {
    _activeRequests++
    const { data } = await axios.post('/api/habit-logs/toggle', {
      habit_id: habitId, date: dateISO, value: desired
    })

    // 古い応答は捨てる
    if (!isLatest(k, opId)) return { ok: true, status: state.checks[k], ignored: 'stale' }

    const effective = normalizeStatus(data?.status, desired)
    if (effective !== desired) {
      state.checks = { ...state.checks, [k]: effective }
      recomputeRates()
      saveSnapshot?.()
    }
    return { ok: true, status: state.checks[k] }
  } catch (e) {
    if (isLatest(k, opId)) {
      // 最新操作の失敗のみロールバック
      state.checks = { ...state.checks, [k]: prev }
      recomputeRates()
      saveSnapshot?.()
    }
    console.error(e)
    return { ok: false, error: e }
  } finally {
    decPending(k)
    _activeRequests = Math.max(0, _activeRequests - 1)
    scheduleReconcileAfterAll()
  }
}

export function useHabitBoard() {
  return { state, todayISO, fetchBoard, toggle, recomputeRates, hydrateFromSnapshot, isFresh }
}
