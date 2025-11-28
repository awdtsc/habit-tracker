// resources/js/stores/useWeeklyBoard.js
import { reactive } from 'vue'
import axios from '@/bootstrap'
import { useHabitBoardStore } from '@/stores/habitBoard/store'   // ← ★ 追加

/* ========================================
 * Utility
 * =======================================*/
function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ========================================
 * State
 * =======================================*/
const state = reactive({
  days: [],
  habits: [],
  scheduled_by_date: {},

  weeklyChecks: [],

  rates: [],

  range_label: '',
  week_start: null,
  week_end: null,

  loaded: false,
})

/* ========================================
 * Weekly Board Fetch
 * =======================================*/
async function fetchWeeklyBoard(startISO = null) {
  const target = startISO ?? todayISO()

  console.log('[WeeklyBoard] fetchWeeklyBoard →', target)

  try {
    const res = await axios.get('/api/weekly-board', {
      params: { start: target }
    })

    const data = res.data || {}
    console.log('[WeeklyBoard] response:', data)

    /* ---- days ---- */
    state.days = Array.isArray(data.days) ? data.days : []

    /* ---- habits (slot number 化) ---- */
    state.habits = (data.habits ?? []).map(h => ({
      ...h,
      id: Number(h.id),
      time_slot: Number(h.time_slot ?? 0),
    }))

    /* ---- scheduled_by_date ---- */
    state.scheduled_by_date = data.scheduled_by_date ?? {}

    /* ---- weeklyChecks ---- */
    state.weeklyChecks = (data.checks ?? []).map(l => ({
      habit_id: Number(l.habit_id),
      date: l.date,
      time_slot: Number(l.time_slot ?? 0),
      status: l.status,
      rating: Number(l.rating ?? 0),
      checked_at: l.checked_at ?? null,
    }))

    /* ---- chart ---- */
    state.rates = data.rates ?? []

    /* ---- range info ---- */
    state.range_label = data.range_label ?? ''
    state.week_start = data.week_start ?? target
    state.week_end = data.week_end ?? null

    state.loaded = true
  } catch (err) {
    console.error('[WeeklyBoard] ERROR fetchWeeklyBoard:', err)
  }
}

/* ========================================
 * isPlanned
 * =======================================*/
function isPlanned(habitId, dateISO) {
  const arr = state.scheduled_by_date?.[dateISO]
  return Array.isArray(arr) && arr.includes(Number(habitId))
}

/* ========================================
 * getStatus
 * =======================================*/
function getStatus(habitId, dateISO) {
  if (!isPlanned(habitId, dateISO)) return null

  const hId = Number(habitId)

  const log = state.weeklyChecks.find(
    l => l.habit_id === hId && l.date === dateISO
  )

  if (!log) return 'pending'
  return log.status === 'done' ? 'done' : 'pending'
}

/* ========================================
 * toggle（★今日はここが核心改修ポイント）
 * =======================================*/
async function toggle(habitId, dateISO, slot = 0) {
  console.log('[WeeklyBoard] toggle:', habitId, dateISO, slot)

  try {
    const res = await axios.post('/api/habit-logs/toggle', {
      habit_id: habitId,
      date: dateISO,
      time_slot: slot,
    })

    const raw = res.data
    if (!raw) return

    const normalized = {
      habit_id: Number(raw.habit_id ?? habitId),
      date: raw.date ?? dateISO,
      time_slot: Number(raw.time_slot ?? slot),
      status: raw.status ?? (raw.value ? 'done' : 'none'),
      rating: Number(raw.rating ?? 0),
      checked_at: raw.checked_at ?? null,
    }

    // existing replace
    const idx = state.weeklyChecks.findIndex(
      l =>
        l.habit_id === normalized.habit_id &&
        l.date === normalized.date &&
        l.time_slot === normalized.time_slot
    )

    if (idx >= 0) {
      state.weeklyChecks.splice(idx, 1, normalized)
    } else {
      state.weeklyChecks.push(normalized)
    }

    // chart
    if (Array.isArray(raw.rates)) {
      state.rates = raw.rates
    }

    /* ----------------------------------------------------
     * ★ ここが本日の修正の本丸（TodayStoreへ反映）
     * ---------------------------------------------------- */
    const board = useHabitBoardStore()
    board.applyExternalLogUpdate(normalized)

  } catch (err) {
    console.error('[WeeklyBoard] ERROR toggle:', err)
  }
}

/* ========================================
 * export
 * =======================================*/
export function useWeeklyBoard() {
  return {
    state,
    fetchWeeklyBoard,
    toggle,
    isPlanned,
    getStatus,
  }
}