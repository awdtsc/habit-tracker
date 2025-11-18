// resources/js/composables/useTodayUi.js
import { computed, watch } from 'vue'

/** UI ストアを安全に初期化して、常に shape が揃っている状態にする */
export function initUiState(ui) {
  ui.state = ui.state || {}

  // フィルタ
  if (!ui.state.filter) {
    ui.state.filter = {
      timeslot: 'auto',      // 'auto' / 'all' / 'morning' など
      showCompleted: true,
      showAnytime: true,
      limit: 0,              // 0:制限なし, 1:1件集中
    }
  } else {
    ui.state.filter.timeslot      ??= 'auto'
    ui.state.filter.showCompleted ??= true
    ui.state.filter.showAnytime   ??= true
    ui.state.filter.limit         ??= 0
  }

  // 完了リストの折りたたみ
  ui.state.collapse = ui.state.collapse || { done: false }
  ui.state.collapse.done ??= false

  // 自動タブ解決用
  if (ui.state.resolvedTimeslot == null) {
    ui.state.resolvedTimeslot = 'morning'
  }

  // フォーカス系
  ui.state.focusedByHabit      = ui.state.focusedByHabit      || {}
  ui.state.focusedAppliedDate  = ui.state.focusedAppliedDate  || null

  // スヌーズ・ストリークリスクなど
  ui.state.snoozedByHabit      = ui.state.snoozedByHabit      || {}
  ui.state.streakRiskByHabit   = ui.state.streakRiskByHabit   || {}

  return ui.state
}

/** フォーカス状態を扱う小さなサブモジュール */
export function createFocusState(ui, serverDateRef) {
  // initUiState の中で shape は保証されている前提
  const focusedByHabit = computed({
    get: () => ui.state.focusedByHabit,
    set: v => (ui.state.focusedByHabit = v || {})
  })

  // 日付が変わったら自動クリア
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
    ui.state.collapse = ui.state.collapse || { done: false }
    ui.state.collapse.done = !ui.state.collapse.done
  }

  return {
    focusedByHabit,
    isFocused,
    toggleFocus,
    toggleCollapseDone,
  }
}