// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// Today State v4 — setTab 復活 + anytime 安定版
//------------------------------------------------------------
import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayState() {

  /* --------------------------------------------------------
   * Store
   * ------------------------------------------------------ */
  let board = null
  const getBoard = () => (board ??= useHabitBoardStore())


  /* --------------------------------------------------------
   * load / loaded
   * ------------------------------------------------------ */
  const loading = ref(false)

  const loaded = computed(() => Boolean(getBoard().todayLoaded))

  async function load(force = false) {
    if (loaded.value && !force) return
    loading.value = true
    try {
      await getBoard().fetchToday()
    } finally {
      loading.value = false
    }
  }


  /* --------------------------------------------------------
   * VM
   * ------------------------------------------------------ */
  const vm       = computed(() => getBoard().todayVM ?? {})
  const planned  = computed(() => getBoard().todayPlanned ?? [])
  const todayYmd = computed(() => getBoard().todayDate ?? null)
  const nowSlot  = computed(() => getBoard().nowSlot ?? null)

  const actionable = computed(() => vm.value.actionable ?? [])
  const done       = computed(() => vm.value.done ?? [])

  // bySlot
  const slots = computed(() =>
    vm.value.bySlot ?? {
      0:{ actionable:[], done:[] },
      1:{ actionable:[], done:[] },
      2:{ actionable:[], done:[] },
      3:{ actionable:[], done:[] },
      4:{ actionable:[], done:[] },
    }
  )

  /* --------------------------------------------------------
   * Anytime（slot 0）
   * ------------------------------------------------------ */
  const anytime = computed(() => {
    const s0 = slots.value?.[0]
    if (!s0) return { actionable: [], done: [] }
    return {
      actionable: Array.isArray(s0.actionable) ? s0.actionable : [],
      done      : Array.isArray(s0.done) ? s0.done : [],
    }
  })


  /* --------------------------------------------------------
   * Progress
   * ------------------------------------------------------ */
  const progress = computed(
    () => vm.value.progress ?? { total:0, completed:0, rate:0 }
  )

  const topPick = computed(() => actionable.value[0] ?? null)


  /* --------------------------------------------------------
   * Slot mode（auto/manual）
   * ------------------------------------------------------ */
  const autoMode     = ref(true)
  const selectedSlot = ref(null)

  const activeSlot = computed(() =>
    autoMode.value ? nowSlot.value : selectedSlot.value
  )

  const activeSlotNum = computed(() => {
    const num = toSlotNum(activeSlot.value)
    return (num >= 1 && num <= 4) ? num : null
  })

  function enableAuto() {
    autoMode.value = true
    selectedSlot.value = null
  }

  function disableAuto() {
    autoMode.value = false
  }

  /* --------------------------------------------------------
   * ★ setTab（復活）
   * ------------------------------------------------------ */
  function setTab(tabName) {
    if (tabName === 'auto') {
      enableAuto()
      return
    }

    disableAuto()

    const map = {
      all     : null,
      morning : 1,
      noon    : 2,
      evening : 3,
      night   : 4,
    }

    selectedSlot.value = map[tabName] ?? null
  }


  /* --------------------------------------------------------
   * Next slot
   * ------------------------------------------------------ */
  const nextSlot = computed(() => {
    const base = toSlotNum(nowSlot.value)
    if (!base || base >= 4) return null

    const ns = base + 1
    const g = slots.value?.[ns]
    return Array.isArray(g?.actionable) && g.actionable.length > 0 ? ns : null
  })

  const nextSlotItems = computed(() => {
    const ns = nextSlot.value
    const g = slots.value?.[ns]
    return g?.actionable ?? []
  })


  /* --------------------------------------------------------
   * toggle
   * ------------------------------------------------------ */
  async function toggle({ id, status, value, rating }) {
    const date = todayYmd.value
    const row = planned.value.find(x => Number(x?.h?.id) === Number(id))
    if (!row) return

    const slot = toSlotNum(row?.h?.time_slot ?? row?.today_log?.time_slot ?? 0)

    await getBoard().toggleLog({
      habit_id: id,
      date,
      time_slot: slot,
      status: status ?? null,
      value : value ?? null,
      rating: rating ?? null,
    })
  }


  /* --------------------------------------------------------
   * Export
   * ------------------------------------------------------ */
  const core = {
    loading, loaded, load,
    vm, planned, todayYmd, nowSlot,
    actionable, done, slots,
    anytime,
    progress, topPick,
    autoMode, selectedSlot, activeSlot, activeSlotNum,
    enableAuto, disableAuto, setTab,
    nextSlot, nextSlotItems,
    toggle,
  }

  if (typeof window !== 'undefined') window.__today = core
  return core
}

export default useTodayState