// resources/js/composables/useTodayTab.js

import { computed, unref } from 'vue'

/**
 * TodayTab の UI / 統合ロジック
 * core は useTodayState() の返り値
 */
export function useTodayTab(core) {

  /* ============================================================
   * useTodayLists の返却値は useTodayState から flat に露出している
   * ========================================================== */

  // 今日やる予定の一覧
  const plannedHabits = core.plannedHabits

  // すべてタブ用
  const allActionable = core.allActionable
  const allDone       = core.allDone

  // slot 切替用
  const slotActionable = core.slotActionable
  const slotDone       = core.slotDone

  // anytime
  const anytimeActionable = core.anytimeActionable
  const anytimeDone       = core.anytimeDone

  // next slot
  const nextSlot       = core.nextSlot
  const nextSlotHabits = core.nextSlotHabits

  // slot grouping
  const bySlot = core.plannedBySlot

  /* ============================================================
   * Top Pick（未完了の中で最優先）
   * ========================================================== */
  const topPick = computed(() => {
    const list = [
      ...unref(allActionable),
      ...unref(slotActionable),
    ]
    return list.length ? list[0] : null
  })

  /* ============================================================
   * Active Slot / Timeslot Labels
   * ========================================================== */
  const activeSlot = core.activeSlot

  const timeslotLabel = computed(() => {
    const s = unref(activeSlot)
    const map = {
      1: '朝',
      2: '昼',
      3: '夕',
      4: '夜',
    }
    if (s == null) return 'すべて'
    return map[s] ?? '—'
  })

  /* ============================================================
   * Progress（★重要）
   * useTodayLists が返すのは progress（ComputedRef）
   * ========================================================== */
  const progress = core.progress  // ← progressRate ではなくこれ！

  /* ============================================================
   * Export
   * ========================================================== */
  return {
    ui: core.ui,

    loading: core.loading,
    loaded: core.loaded,

    /* 一覧データ */
    plannedHabits,
    bySlot,

    allActionable,
    allDone,

    slotActionable,
    slotDone,

    anytimeActionable,
    anytimeDone,

    nextSlot,
    nextSlotHabits,

    topPick,
    activeSlot,
    timeslotLabel,
    progress,

    /* 操作関数 */
    onUpdate: core.onUpdate,
    getTodayLog: core.getTodayLog,
    isFocused: core.isFocused,
    toggleFocus: core.toggleFocus,
    toggleCollapseDone: core.toggleCollapseDone,

    todayYmd: core.todayYmd,
    ymd: core.ymd,
  }
}

export default useTodayTab