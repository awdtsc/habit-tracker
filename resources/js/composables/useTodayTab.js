// resources/js/composables/useTodayTab.js
import { createTodayLists, sortToday } from './useTodayLists'

/**
 * Today タブ用 UI ロジック
 * - 引数 core には useTodayState() の戻り値を必ず渡す
 * - ここでは「派生リスト」と「UI 向けのまとめ」を作るだけ
 */
export function useTodayTab(core) {
  if (!core) {
    throw new Error('[useTodayTab] core is required. Call useTodayState() and pass it in.')
  }

  const lists = createTodayLists({
    ui: core.ui,
    habits: core.habits,
    board: core.board,
    serverNow: core.serverNow,
    serverNowSlot: core.serverNowSlot,
    apiTopPick: core.apiTopPick,
    nowDateObj: core.nowDateObj,
    todayYmd: core.todayYmd,
    ymd: core.ymd,
  })

  return {
    // --- 状態そのもの ---
    ui: core.ui,
    loading: core.loading,
    loaded: core.loaded,
    habits: core.habits,

    // --- 派生リスト ---
    plannedHabits: lists.plannedHabits,
    resolvedTimeslot: lists.resolvedTimeslot,
    resolvedTimeslotLabel: lists.resolvedTimeslotLabel,
    timeslotLabel: lists.timeslotLabel,
    topPick: lists.topPick,
    actionable: lists.actionable,
    actionableOnly: lists.actionableOnly,
    done: lists.done,
    anytime: lists.anytime,
    anytimeDisplay: lists.anytimeDisplay,
    anyDone: lists.anyDone,
    nextSlotHabits: lists.nextSlotHabits,
    nextSlot: lists.nextSlot,

    // --- 操作 ---
    onUpdate: core.onUpdate,
    getTodayLog: core.getTodayLog,
    isFocused: core.isFocused,
    toggleFocus: core.toggleFocus,
    toggleCollapseDone: core.toggleCollapseDone,

    // --- 日付系 ---
    todayYmd: core.todayYmd,
    ymd: core.ymd,
  }
}

// 既存互換
export { sortToday } from './useTodayLists'
export default useTodayTab