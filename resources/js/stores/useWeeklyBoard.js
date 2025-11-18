// resources/js/stores/useWeeklyBoard.js
import { reactive } from 'vue'
import axios from '@/axios'   // ← 他と同じ共通 axios を使う

/**
 * WeeklyBoard のグローバル状態
 * /api/weekly-board のレスポンス構造に完全準拠
 *
 * ※ TodayTab の useHabitBoard とは絶対に混ざらないよう、
 *    checks は weeklyChecks として完全分離する。
 */
const state = reactive({
  days: [],               // [{ iso, label, d, isToday, isFuture }]
  habits: [],             // [{ id, title, ... }]
  weeklyChecks: [],       // WeeklyBoard 専用 HabitLog 配列
  scheduled_by_date: {},  // { 'YYYY-MM-DD': [habitId, habitId...] }
  rates: [],              // [0,50,100...]
  range_label: '',
  week_start: null,
  week_end: null,

  // 追加: 週ボードの初回ロードフラグ
  loaded: false,
})

/**
 * ================================
 *   週次データを取得
 * ================================
 */
async function fetchWeeklyBoard(startISO = null) {
  console.log('[WeeklyBoard] fetch called:', startISO)

  const params = startISO ? { start: startISO } : {}

  try {
    const res = await axios.get('/api/weekly-board', { params })
    console.log('[WeeklyBoard] response:', res.data)

    const data = res.data || {}

    state.days = data.days ?? []
    state.habits = data.habits ?? []
    state.scheduled_by_date = data.scheduled_by_date ?? {}

    // ★ Today 用 HabitBoard とは絶対に共有しない
    state.weeklyChecks = data.checks ?? []

    state.rates = data.rates ?? []
    state.range_label = data.range_label ?? ''
    state.week_start = data.week_start ?? null
    state.week_end = data.week_end ?? null

    state.loaded = true   // ← 初回ロード完了

  } catch (err) {
    console.error('[WeeklyBoard] ERROR fetchWeeklyBoard:', err)
  }
}

/**
 * ================================
 *   この日付にその習慣が予定されているか
 * ================================
 */
function isPlanned(habitId, dateISO) {
  const arr = state.scheduled_by_date?.[dateISO]
  return Array.isArray(arr) && arr.includes(habitId)
}

/**
 * ================================
 *   セルのステータス取得
 *   - null      → 予定なし
 *   - 'pending' → 予定あり・未完了
 *   - 'done'    → 完了
 * ================================
 */
function getStatus(habitId, dateISO) {
  if (!isPlanned(habitId, dateISO)) return null

  const log = state.weeklyChecks.find(
    (l) => l.habit_id === habitId && l.date === dateISO
  )

  if (log && log.status === 'done') return 'done'
  return 'pending'
}

/**
 * ================================
 *   トグル（チェック／解除）
 * ================================
 */
async function toggle(habitId, dateISO) {
  console.log('[WeeklyBoard] toggle:', habitId, dateISO)

  try {
    const res = await axios.post('/api/habit-logs/toggle', {
      habit_id: habitId,
      date: dateISO,
    })

    const updatedLog = res.data?.log
    if (!updatedLog) return

    // 既存ログの置換 or 新規追加
    const idx = state.weeklyChecks.findIndex(
      (l) => l.habit_id === habitId && l.date === dateISO
    )

    if (idx >= 0) {
      state.weeklyChecks[idx] = updatedLog
    } else {
      state.weeklyChecks.push(updatedLog)
    }

    // 週達成率が返ってきたら更新
    if (Array.isArray(res.data?.rates)) {
      state.rates = res.data.rates
    }

  } catch (err) {
    console.error('[WeeklyBoard] ERROR toggle:', err)
  }
}

/**
 * ================================
 *   export composable
 * ================================
 */
export function useWeeklyBoard() {
  return {
    state,
    fetchWeeklyBoard,
    toggle,
    isPlanned,
    getStatus,
  }
}