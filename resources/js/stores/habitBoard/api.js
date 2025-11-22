// resources/js/stores/habitBoard/api.js

import axios from '@/axios'

/* ============================================================
 * GET /api/today
 * ========================================================== */
export async function apiFetchToday() {
  const { data } = await axios.get('/api/today', {
    withCredentials: true,
  })
  return data
}

/* ============================================================
 * GET /api/weekly-board
 * ========================================================== */
export async function apiFetchWeeklyBoard(params = {}) {
  const { data } = await axios.get('/api/weekly-board', {
    params,
    withCredentials: true,
  })
  return data
}

/* ============================================================
 * POST /api/habit-logs/toggle
 * ========================================================== */
export async function apiToggleHabitLog(payload) {
  const { data } = await axios.post('/api/habit-logs/toggle', payload, {
    withCredentials: true,
  })
  return data
}
