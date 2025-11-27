// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// Today State v3（遅延初期化 + HabitBoardStore 連携 / 完全安定版）
//------------------------------------------------------------
import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayState() {

  let board = null
  const getBoard = () => (board ??= useHabitBoardStore())

  const loading = ref(false)

  const loaded = computed(() => getBoard().todayLoaded ?? false)

  // ----------------------------------------------------------
  // 初回ロード（toggle後には呼ばない）
  // ----------------------------------------------------------
  async function load(force = false) {
    if (loaded.value && !force) return
    const b = getBoard()
    loading.value = true
    try {
      await b.fetchToday()
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
  // progress（store 側で前計算された値を利用）
  // ----------------------------------------------------------
  const progress = computed(() => vm.value.progress ?? { total: 0, completed: 0, done: 0, rate: 0 })

  // ----------------------------------------------------------
  // topPick（store 前計算済み）
  // ----------------------------------------------------------
  const topPick = computed(() => vm.value.topPick ?? null)

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

  const activeSlotNum = computed(() => {
    const raw = autoMode.value ? nowSlot.value : selectedSlot.value
    const num = toSlotNum(raw)
    return num >= 1 && num <= 4 ? num : null
  })

  // ----------------------------------------------------------
  // nextSlot（AUTO と SLOT モードでのみ使用）
  // ----------------------------------------------------------
  const nextSlot = computed(() => {
    const base = activeSlotNum.value
    if (!base) return null
    if (base >= 4) return null
    return base + 1
  })

  const nextSlotItems = computed(() => {
    const ns = nextSlot.value
    if (!ns) return []
    return slots.value?.[ns]?.actionable ?? []
  })

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

    await b.toggleLog(payload)
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
    nextSlotItems,
    autoMode,
    selectedSlot,
    activeSlot,
    activeSlotNum,
    enableAuto,
    disableAuto,
    toggle,
  }

  if (typeof window !== 'undefined') window.__today = core
  return core
}

export default useTodayState
