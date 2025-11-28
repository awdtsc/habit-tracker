// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// Today State v4 — VM一本化 + priority 統一 + TopPick=ALL 最優先
//------------------------------------------------------------
import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayState() {

  //------------------------------------------------------------
  // Store（遅延初期化）
  //------------------------------------------------------------
  let board = null
  const getBoard = () => (board ??= useHabitBoardStore())

  //------------------------------------------------------------
  // loading / loaded
  //------------------------------------------------------------
  const loading = ref(false)

  const loaded = computed(() => {
    const b = getBoard()
    return Boolean(b.todayLoaded)
  })

  //------------------------------------------------------------
  // 初回ロード
  //------------------------------------------------------------
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

  //------------------------------------------------------------
  // Raw VM（Store → 見える値の唯一ソース）
  //------------------------------------------------------------
  const vm       = computed(() => getBoard().todayVM       ?? {})
  const planned  = computed(() => getBoard().todayPlanned ?? [])
  const todayYmd = computed(() => getBoard().todayDate    ?? null)
  const nowSlot  = computed(() => getBoard().nowSlot      ?? null)

  //------------------------------------------------------------
  // Priority ソート
  //------------------------------------------------------------
  const sortByPriority = (list = []) =>
    [...list].sort((a, b) => {
      const pa = Number(a?.h?.priority ?? 0)
      const pb = Number(b?.h?.priority ?? 0)
      return pb - pa   // 高い順
    })

  //------------------------------------------------------------
  // ALL（未完了 / 完了）
  //------------------------------------------------------------
  const actionable = computed(() =>
    sortByPriority(vm.value.actionable ?? [])
  )

  const done = computed(() =>
    sortByPriority(vm.value.done ?? [])
  )

  //------------------------------------------------------------
  // bySlot = {0:{actionable[],done[]},1:{…}}
  //------------------------------------------------------------
  const slots = computed(() => {
    const raw = vm.value.bySlot ?? {
      0:{ actionable:[], done:[] },
      1:{ actionable:[], done:[] },
      2:{ actionable:[], done:[] },
      3:{ actionable:[], done:[] },
      4:{ actionable:[], done:[] },
    }

    const dst = {}

    for (let s = 0; s <= 4; s++) {
      const grp = raw[s] ?? { actionable:[], done:[] }
      dst[s] = {
        actionable: sortByPriority(grp.actionable ?? []),
        done      : sortByPriority(grp.done ?? []),
      }
    }
    return dst
  })

  //------------------------------------------------------------
  // progress
  //------------------------------------------------------------
  const progress = computed(() => {
    const p = vm.value.progress
    if (!p) return { total:0, completed:0, done:0, rate:0 }
    return p
  })

  //------------------------------------------------------------
  // ★ topPick = ALL の "未完了の最優先" に一本化
  //------------------------------------------------------------
  const topPick = computed(() => {
    const arr = actionable.value
    return arr.length ? arr[0] : null
  })

  //------------------------------------------------------------
  // Slot mode（Auto / Manual 切替）
  //------------------------------------------------------------
  const autoMode     = ref(true)
  const selectedSlot = ref(null)

  const activeSlot = computed(() =>
    autoMode.value ? nowSlot.value : selectedSlot.value
  )

  function enableAuto() {
    autoMode.value = true
    selectedSlot.value = null
  }
  function disableAuto() {
    autoMode.value = false
  }

  const activeSlotNum = computed(() =>
    toSlotNum(autoMode.value ? nowSlot.value : selectedSlot.value)
  )

  //------------------------------------------------------------
  // nextSlot（「今の時間帯」基準での次スロット）
  //------------------------------------------------------------
  const nextSlot = computed(() => {
    const base = toSlotNum(nowSlot.value)
    if (!base || base >= 4) return null

    const next = base + 1
    const group = slots.value?.[next]

    if (group && group.actionable?.length > 0) {
      return next
    }

    return null
  })

  const nextSlotItems = computed(() => {
    const ns = nextSlot.value
    if (!ns) return []
    const group = slots.value?.[ns]
    return sortByPriority(group?.actionable ?? [])
  })

  //------------------------------------------------------------
  // toggle（完了/未完）
  //------------------------------------------------------------
  async function toggle({ id, status, value, rating }) {
    const b = getBoard()
    const date = todayYmd.value

    if (!id || !date) {
      console.warn('[toggle] Missing id/date', { id, date })
      return
    }

    const row = planned.value.find(x => Number(x?.h?.id) === Number(id))
    if (!row) {
      console.warn('[toggle] habit not found id=', id)
      return
    }

    const slot = toSlotNum(row?.h?.time_slot ?? row?.today_log?.time_slot ?? 0)

    const payload = {
      habit_id: id,
      date,
      time_slot: slot,
      value  : value  ?? null,
      rating : rating ?? null,
      status : status ?? null,
    }

    // optimistic + confirmed + VM再生成
    await b.toggleLog(payload)
  }

  //------------------------------------------------------------
  // Tab Setter
  //------------------------------------------------------------
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

  //------------------------------------------------------------
  // Export
  //------------------------------------------------------------
  const core = {
    loading, loaded,
    load,

    vm,
    planned,
    todayYmd,
    nowSlot,

    actionable,   // ★ ALL（未完了） priority ソート済
    done,         // ★ ALL（完了） priority ソート済
    slots,        // ★ slotごとに priority ソート済

    progress,
    topPick,      // ★ ALL の最優先

    nextSlot,
    nextSlotItems,

    autoMode,
    selectedSlot,
    activeSlot,
    activeSlotNum,
    enableAuto,
    disableAuto,

    toggle,
    setTab,
  }

  if (typeof window !== 'undefined') window.__today = core
  return core
}

export default useTodayState