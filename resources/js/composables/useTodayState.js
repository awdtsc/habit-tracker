// resources/js/composables/useTodayState.js
//------------------------------------------------------------
// Today State v3 — HabitBoardStore 直結・完全安定版
//------------------------------------------------------------
import { ref, computed } from 'vue'
import { useHabitBoardStore } from '@/stores/habitBoard/store'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayState() {

  //------------------------------------------------------------
  // Store（遅延初期化・単一インスタンス保証）
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
  // Store → VM（唯一のソース）
  //------------------------------------------------------------
  const vm       = computed(() => getBoard().todayVM       ?? {})
  const planned  = computed(() => getBoard().todayPlanned ?? [])
  const todayYmd = computed(() => getBoard().todayDate    ?? null)
  const nowSlot  = computed(() => getBoard().nowSlot      ?? null)

  const actionable = computed(() => vm.value.actionable ?? [])
  const done       = computed(() => vm.value.done       ?? [])

  // bySlot = {0:{actionable[],done[]},1:{…}}
  const slots = computed(() =>
    vm.value.bySlot ?? {
      0:{ actionable:[], done:[] },
      1:{ actionable:[], done:[] },
      2:{ actionable:[], done:[] },
      3:{ actionable:[], done:[] },
      4:{ actionable:[], done:[] },
    }
  )

  //------------------------------------------------------------
  // progress / topPick
  //------------------------------------------------------------
  const progress = computed(() => {
    const p = vm.value.progress
    if (!p) return { total:0, completed:0, done:0, rate:0 }
    return p
  })

  const topPick = computed(() => vm.value.topPick ?? null)

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

  // 数値化スロット（1〜4）以外は null
  const activeSlotNum = computed(() => {
    const raw = autoMode.value ? nowSlot.value : selectedSlot.value
    const num = toSlotNum(raw)
    return (num >= 1 && num <= 4) ? num : null
  })

  //------------------------------------------------------------
  // nextSlot（「今の時間帯」基準での次スロット）
  //------------------------------------------------------------
  const nextSlot = computed(() => {
    // ① 常に「今の時間帯」から見た slot を使う
    const base = toSlotNum(nowSlot.value)
    if (!base || base >= 4) return null

    // ② 直後の 1 スロットだけを見る
    const next = base + 1
    const group = slots.value?.[next]

    // ③ 次スロットに actionable が 1件以上ある場合のみ有効
    if (group && Array.isArray(group.actionable) && group.actionable.length > 0) {
      return next
    }

    // ④ それ以外は「次にやる習慣なし」
    return null
  })

  const nextSlotItems = computed(() => {
    const ns = nextSlot.value
    if (!ns) return []
    const group = slots.value?.[ns]
    return group?.actionable ?? []
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

    // planned から対象 row 取得
    const row = planned.value.find(x => Number(x?.h?.id) === Number(id))
    if (!row) {
      console.warn('[toggle] habit not found id=', id)
      return
    }

    // 本日の slot を決定（h.time_slot → today_log.time_slot）
    const slot = toSlotNum(row?.h?.time_slot ?? row?.today_log?.time_slot ?? 0)

    const payload = {
      habit_id: id,
      date,
      time_slot: slot,
      value    : value  ?? null,
      rating   : rating ?? null,
      status   : status ?? null,
    }

    // Store（optimistic → confirmed → VM 再構築）
    await b.toggleLog(payload)
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