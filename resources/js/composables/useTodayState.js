// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// v2 専用 Today State（v1 ロジック完全排除版）
//------------------------------------------------------------

import { ref, computed } from 'vue'

import { useUiState } from '@/stores/uiState'
import { useHabitBoardStore } from '@/stores/habitBoard'
import * as habitBoardApi from '@/stores/habitBoard/api'
import { selectTodayViewModel } from '@/stores/habitBoard/selectors'

import { initUiState, createFocusState } from './useTodayUi'
import { useTodayActions } from './today/useTodayActions'


export function useTodayState() {

  /* ------------------------------------------------------------
   * 0. UI（タブ・フィルタ・スロット）
   * ---------------------------------------------------------- */
  const ui = useUiState()
  initUiState(ui)


  /* ------------------------------------------------------------
   * 1. Board（log 更新などで利用）
   * ---------------------------------------------------------- */
  const board = useHabitBoardStore()


  /* ------------------------------------------------------------
   * 2. /api/today のデータ
   * ---------------------------------------------------------- */
  const loading = ref(false)
  const loaded  = ref(false)

  const todayRaw = ref(null)  // /api/today の生データ
  const vm       = ref(null)  // selectors.js が返す正規 ViewModel


  async function fetchToday() {
    loading.value = true
    try {
      //--------------------------------------------------------
      // /api/today を取得
      //--------------------------------------------------------
      const data = await habitBoardApi.apiFetchToday()
      todayRaw.value = data

      //--------------------------------------------------------
      // selectors.js の VM に一本化
      //--------------------------------------------------------
      vm.value = selectTodayViewModel({
        planned : data?.planned ?? [],
        date    : data?.date ?? '',
        nowSlot : data?.now_slot ?? null,
      })

      loaded.value = true

    } finally {
      loading.value = false
    }
  }


  /* ------------------------------------------------------------
   * 3. Focus 状態
   * ---------------------------------------------------------- */
  const focus = createFocusState(ui, () => todayRaw.value?.date)


  /* ------------------------------------------------------------
   * 4. Toggle / Rating / Snooze など Today アクション
   * ---------------------------------------------------------- */
  const actions = useTodayActions(
    board,

    // items = VM の items（v2 本流）
    computed(() => vm.value?.items ?? []),

    // その日の date（YYYY-MM-DD）
    computed(() => todayRaw.value?.date ?? ''),

    ui,

    // topPick（おすすめ習慣）
    computed(() => vm.value?.topPick ?? null),
  )


  /* ------------------------------------------------------------
   * 5. Export
   * ---------------------------------------------------------- */
  return {
    ui,
    board,

    loading,
    loaded,
    fetchToday,

    todayRaw,
    vm,

    // Focus
    ...focus,

    // Actions
    ...actions,

    // 日付
    todayYmd: computed(() => todayRaw.value?.date ?? ''),

    // v2 VM の items（= planned）
    plannedHabits: computed(() => vm.value?.items ?? []),

    // slot grouping（selectors 由来）
    bySlot: computed(() => vm.value?.bySlot ?? {}),

    // actionable / done
    actionable: computed(() => vm.value?.actionable ?? []),
    done:       computed(() => vm.value?.done ?? []),

    // next slot
    nextSlot: computed(() => vm.value?.nextSlot ?? null),

    // top pick
    topPick: computed(() => vm.value?.topPick ?? null),

    // progress { total, completed, rate }
    progress: computed(() => vm.value?.progress ?? { total: 0, completed: 0, rate: 0 }),
  }
}

export default useTodayState