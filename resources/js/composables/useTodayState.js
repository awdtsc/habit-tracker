// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// ミニマル Today State（v3）
//   - 依存ゼロ
//   - store.todayVM のみを使う
//   - fetchToday() も store に一本化
//------------------------------------------------------------

import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'

export function useTodayState() {

  //------------------------------------------------------------
  // 1. Store（唯一の依存先）
  //------------------------------------------------------------
  const board = useHabitBoardStore()

  //------------------------------------------------------------
  // 2. ローカル状態
  //------------------------------------------------------------
  const loading = ref(false)
  const loaded  = ref(false)

  //------------------------------------------------------------
  // 3. 今日のデータをロード（store を利用）
  //------------------------------------------------------------
  async function load() {
    loading.value = true
    try {
      await board.fetchToday()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  //------------------------------------------------------------
  // 4. VM / planned / date / progress などを store から引き出す
  //------------------------------------------------------------
  const vm              = computed(() => board.todayVM)
  const planned         = computed(() => board.todayPlanned)
  const todayYmd        = computed(() => board.todayDate)
  const nowSlot         = computed(() => board.nowSlot)

  const bySlot          = computed(() => vm.value?.bySlot ?? {})
  const actionable      = computed(() => vm.value?.actionable ?? [])
  const done            = computed(() => vm.value?.done ?? [])
  const nextSlot        = computed(() => vm.value?.nextSlot ?? null)
  const topPick         = computed(() => vm.value?.topPick ?? null)
  const progress         = computed(() => vm.value?.progress ?? { total:0, completed:0, rate:0 })

  //------------------------------------------------------------
  // 5. Toggle も store の toggleLog() を直接使う
  //------------------------------------------------------------
  async function toggle(payload) {
    return await board.toggleLog(payload)
  }

  //------------------------------------------------------------
  // 6. Export — TodayTab.vue がこれを使うだけ
  //------------------------------------------------------------
  return {
    // 状態
    loading,
    loaded,

    // 読み込み
    load,

    // 値
    vm,
    planned,
    todayYmd,
    nowSlot,
    bySlot,
    actionable,
    done,
    nextSlot,
    topPick,
    progress,

    // 操作
    toggle,
  }
}

export default useTodayState