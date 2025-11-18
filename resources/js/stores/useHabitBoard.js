// resources/js/stores/useHabitBoard.js
import {
  state,
  todayISO,
  logKey,
  toSlotNum,
  isScheduledFor,
  isDone,
  recomputeRates,
  getLog,
} from './useHabitBoardCore'

import {
  fetchBoard,
  toggle,
  loadLogs,
  setupHabitBoardAuthEvents,
} from './useHabitBoardActions'

// ブラウザ起動時に一度だけ auth イベントをセット
setupHabitBoardAuthEvents()

/* ========= メインの composable ========= */
export function useHabitBoard() {
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

/* 既存互換: 他のモジュールから直接 import されている可能性があるもの */
export { logKey, toSlotNum } from './useHabitBoardCore'