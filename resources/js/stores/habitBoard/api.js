// resources/js/stores/habitBoard/api.js

import axios from '@/axios'

/**
 * HabitBoard v2 用 API モジュール
 *
 * 役割：
 *  - エンドポイント呼び出しだけを担当（Pinia には依存しない）
 *  - 正規化やストア更新は store 側（store.js / selectors.js）で行う
 *
 * 既存のエンドポイント：
 *  - GET  /api/today
 *  - GET  /api/weekly-board
 *  - POST /api/habit-logs/toggle
 */

/* ============================================================
 * GET /api/today
 * ------------------------------------------------------------
 * 例：
 * {
 *   planned: [{ h, today_log, pending_task }, ...],
 *   progress: { planned_count, done_count },
 *   top_pick: {...} | null,
 *   now: "2025-11-21 15:35:34",
 *   date: "2025-11-21",
 *   timezone: "Asia/Tokyo",
 *   now_slot: 2,
 *   slot_defs: [...]
 * }
 * ========================================================== */
export async function apiFetchToday() {
  const { data } = await axios.get('/api/today', {
    withCredentials: true,
  })
  return data
}

/* ============================================================
 * GET /api/weekly-board
 * ------------------------------------------------------------
 * params: { start?: 'YYYY-MM-DD' } など
 * 週タブ用の生データを取るためのラッパ。
 * v2 では HabitBoard 側から呼び出して統合する予定。
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
 * ------------------------------------------------------------
 * payload 例：
 * {
 *   habit_id: number,
 *   date: 'YYYY-MM-DD',
 *   time_slot: number,
 *   action: 'toggle' | 'done' | 'none',
 *   rating?: number
 * }
 *
 * レスポンス例（既存実装に合わせる）：
 * {
 *   log: { habit_id, date, time_slot, status, rating, ... },
 *   today_rate?: { planned_count, done_count },
 *   top_pick?: {...}
 * }
 * ========================================================== */
export async function apiToggleHabitLog(payload) {
  const { data } = await axios.post('/api/habit-logs/toggle', payload, {
    withCredentials: true,
  })
  return data
}

/* ============================================================
 * 将来拡張用の skeleton
 * ------------------------------------------------------------
 * - /api/habit-logs/range で一括取得
 * - /api/today-week で「今日＋週」をまとめて取得
 * などを追加していく想定。
 * ========================================================== */

// 例: 期間指定ログ取得（実装前のひな型）
export async function apiFetchHabitLogsRange(params = {}) {
  // まだバックエンド側にエンドポイントが無ければ未使用でOK
  const { data } = await axios.get('/api/habit-logs/range', {
    params,
    withCredentials: true,
  })
  return data
}