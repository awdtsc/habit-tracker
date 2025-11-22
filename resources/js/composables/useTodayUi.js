// resources/js/composables/useTodayUi.js
import { computed, watch } from 'vue'

/**
 * v2 TodayTab に完全対応した UI 初期化
 *
 * timeslot の値を以下に統一する：
 *   'auto'         → 自動
 *   'all'          → すべて
 *   '1' | '2' | '3' | '4' → 朝/昼/夕/夜
 */
export function initUiState(ui) {
  ui.state = ui.state || {}

  // ------------------------------
  // filter
  // ------------------------------
  if (!ui.state.filter) {
    ui.state.filter = {
      timeslot: 'auto',       // v2標準
      showCompleted: true,
      showAnytime: true,
      limit: 0,
    }
  } else {
    // v1 の 'morning' / 'noon' などを v2 の数値形式に変換
    const legacy = ui.state.filter.timeslot

    const map = {
      morning: '1',
      noon: '2',
      evening: '3',
      night: '4',
    }

    // legacy 値を変換
    if (legacy in map) {
      ui.state.filter.timeslot = map[legacy]
    }

    // fallback
    ui.state.filter.timeslot ??= 'auto'
    ui.state.filter.showCompleted ??= true
    ui.state.filter.showAnytime ??= true
    ui.state.filter.limit ??= 0
  }

  // ------------------------------
  // collapse
  // ------------------------------
  ui.state.collapse = ui.state.collapse || {}
  ui.state.collapse.done ??= false

  // ------------------------------
  // focus
  // ------------------------------
  ui.state.focusedByHabit ??= {}
  ui.state.focusedAppliedDate ??= null

  // optional: snooze / streak
  ui.state.snoozedByHabit ??= {}
  ui.state.streakRiskByHabit ??= {}

  return ui.state
}

/**
 * フォーカス
 */
export function createFocusState(ui, serverDateRef) {
  const focusedByHabit = computed({
    get: () => ui.state.focusedByHabit,
    set: v => (ui.state.focusedByHabit = v || {}),
  })

  // 日付が変わったらフォーカスクリア
  watch(
    () => serverDateRef.value,
    (d) => {
      if (!d) return
      if (ui.state.focusedAppliedDate && ui.state.focusedAppliedDate !== d) {
        ui.state.focusedByHabit = {}
      }
      ui.state.focusedAppliedDate = d
    },
    { immediate: true }
  )

  function isFocused(id) {
    return !!focusedByHabit.value?.[Number(id)]
  }

  function toggleFocus(id) {
    const k = Number(id)
    const cur = !!focusedByHabit.value[k]
    focusedByHabit.value = { ...focusedByHabit.value, [k]: !cur }
  }

  function toggleCollapseDone() {
    ui.state.collapse.done = !ui.state.collapse.done
  }

  return {
    focusedByHabit,
    isFocused,
    toggleFocus,
    toggleCollapseDone,
  }
}
