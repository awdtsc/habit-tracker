// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// Today State v3（遅延初期化 + HabitBoardStore 連携 / 完全安定版）
//------------------------------------------------------------
import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'

export function useTodayState() {

  let board = null
  const getBoard = () => (board ??= useHabitBoardStore())

  const loading = ref(false)
  const loaded  = ref(false)

  // ----------------------------------------------------------
  // 初回ロード（toggle後には呼ばない）
  // ----------------------------------------------------------
  async function load() {
    const b = getBoard()
    loading.value = true
    try {
      await b.fetchToday()
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  // ----------------------------------------------------------
  // board の値をそのまま反映
  // ----------------------------------------------------------
  const vm       = computed(() => getBoard().todayVM ?? {})
  const planned  = computed(() => getBoard().todayPlanned ?? [])
  const todayYmd = computed(() => getBoard().todayDate)
  const nowSlot  = computed(() => getBoard().nowSlot)

  const actionable = computed(() => vm.value.actionable ?? [])
  const done       = computed(() => vm.value.done ?? [])
  const slots      = computed(() => vm.value.bySlot ?? {})

  // ----------------------------------------------------------
  // progress
  // ----------------------------------------------------------
  const progress = computed(() => {
    const total = planned.value.length
    const doneCount = done.value.length
    return {
      total,
      done: doneCount,
      rate: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    }
  })

  // ----------------------------------------------------------
  // topPick
  // ----------------------------------------------------------
  const topPick = computed(() => {
    return actionable.value.length ? actionable.value[0] : null
  })

  // ----------------------------------------------------------
  // nextSlot
  // ----------------------------------------------------------
  const nextSlot = computed(() => {
    const now = nowSlot.value
    if (!now || now < 1 || now > 4) return null

    for (let s = now + 1; s <= 4; s++) {
      if (slots.value[s] && slots.value[s].actionable.length > 0) {
        return s
      }
    }
    return null
  })

  // ----------------------------------------------------------
  // Auto / Manual Slot
  // ----------------------------------------------------------
  const autoMode     = ref(true)
  const selectedSlot = ref(null)

  const activeSlot = computed(() => {
    if (autoMode.value) return nowSlot.value
    return selectedSlot.value
  })

  function enableAuto() {
    autoMode.value = true
    selectedSlot.value = null
  }

  function disableAuto() {
    autoMode.value = false
  }

  // ----------------------------------------------------------
  // toggle（完了 → 完了セクションへ移動）
  // ----------------------------------------------------------
  async function toggle({ id, status, value, rating }) {
    const b = getBoard()

    const p = planned.value.find(x => x.h?.id === id)
    if (!p) {
      console.warn('[toggle] habit not found id=', id)
      return
    }

    const payload = {
      habit_id : id,
      date     : todayYmd.value,
      time_slot: p.h.time_slot,
      value    : value ?? null,
      rating   : rating ?? null,
      status   : status ?? undefined,
    }

    // ★ API 呼び出し & store 内部ライブ更新
    await b.toggleLog(payload)

    // ★ load() を呼ばない（ここが重要）
    // → ライブ更新された todayLogs & todayPlanned によって
    //    todayVM が即座に再計算される
    // → 完了した習慣がすぐ done[] に入る
  }

  const core = {
    loading, loaded,
    load,
    vm,
    planned,
    todayYmd,
    nowSlot,
    actionable,
    done,
    slots,
    progress,
    topPick,
    nextSlot,
    autoMode,
    selectedSlot,
    activeSlot,
    enableAuto,
    disableAuto,
    toggle,
  }

  if (typeof window !== 'undefined') window.__today = core
  return core
}

export default useTodayState
