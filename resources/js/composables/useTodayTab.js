// resources/js/composables/useTodayTab.js
import { computed, unref } from 'vue'
import { createTodayLists } from './useTodayLists'

/** 安全に配列へ正規化 */
const normalizeArray = (raw) => {
  const v = unref(raw)
  return Array.isArray(v) ? v : []
}

export function useTodayTab(core) {
  if (!core) {
    throw new Error('[useTodayTab] core is required.')
  }

  /* ============================================================
   * createTodayLists（TodayState 由来のデータを使用）
   * ========================================================== */
  const lists = createTodayLists({
    ui: core.ui,
    habits: core.habits,
    board: { getLog: core.getTodayLog },
    todayYmd: core.todayYmd,
    serverNow: core.serverNow,
    serverNowSlot: core.serverNowSlot,
  })

  /* ============================================================
   * unwrap（Ref → 値）
   * ========================================================== */
  const plannedHabits  = computed(() => normalizeArray(lists.plannedHabits?.value))
  const actionable     = computed(() => normalizeArray(lists.actionable?.value))
  const anytime        = computed(() => normalizeArray(lists.anytime?.value))
  const nextSlotHabits = computed(() => normalizeArray(lists.nextSlotHabits?.value))
  const nextSlot       = computed(() => unref(lists.nextSlot?.value) ?? null)
  const done           = computed(() => normalizeArray(lists.done?.value))

  /* ============================================================
   * Slot grouping（フィルタ後）
   * ========================================================== */
  const bySlot = computed(() => {
    const g = lists.bySlot?.value ?? lists.bySlot ?? null
    return g ?? { 0: [], 1: [], 2: [], 3: [], 4: [] }
  })

  /* ============================================================
   * Top Pick（アクション候補から優先）
   * ========================================================== */
  const topPick = computed(() => {
    const source = actionable.value.filter((item) => {
      const st = item.log?.status
      const doneFlag = item.log?.done || st === 'done' || st === 1
      return !doneFlag
    })
    const fallback = actionable.value
    const base = source.length ? source : fallback
    if (!base.length) return null
    return base[0]
  })

  /* ============================================================
   * Timeslot ラベル
   * ========================================================== */
  const activeSlot = computed(() => unref(lists.activeSlot))
  const timeslotLabel = computed(() => {
    const s = activeSlot.value
    const map = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }
    return s == null ? 'すべて' : map[s] ?? '—'
  })

  /* ============================================================
   * Progress
   * ========================================================== */
  const progress = computed(() => lists.progress?.value ?? { total: 0, completed: 0 })

  /* ============================================================
   * Export
   * ========================================================== */
  return {
    ui: core.ui,
    loading: core.loading,
    loaded: core.loaded,

    lists,

    bySlot,
    plannedHabits,
    actionable,
    anytime,
    done,

    nextSlotHabits,
    nextSlot,

    topPick,

    activeSlot,
    timeslotLabel,

    progress,

    /* 操作系 */
    onUpdate: core.onUpdate,
    getTodayLog: core.getTodayLog,
    isFocused: core.isFocused,
    toggleFocus: core.toggleFocus,
    toggleCollapseDone: core.toggleCollapseDone,

    /* Date tools */
    todayYmd: core.todayYmd,
    ymd: core.ymd,
  }
}

export default useTodayTab