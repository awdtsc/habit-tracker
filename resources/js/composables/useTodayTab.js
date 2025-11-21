// resources/js/composables/useTodayTab.js
import { computed, unref } from 'vue'

/**
 * TodayTab 用の統合ロジック
 * core は useTodayCore() の返り値
 */
export function useTodayTab(core) {
  const lists = core.lists

  const plannedHabits = computed(() => lists.plannedHabits?.value ?? [])
  const actionable = computed(() => lists.actionable?.value ?? [])
  const anytime = computed(() => lists.anytime?.value ?? [])
  const done = computed(() => lists.done?.value ?? [])

  const nextSlotHabits = computed(() => lists.nextSlotHabits?.value ?? [])
  const nextSlot = computed(() => lists.nextSlot?.value ?? null)

  const bySlot = computed(() => {
    const g = lists.bySlot?.value
    return g ?? { 0: [], 1: [], 2: [], 3: [], 4: [] }
  })

  /* ============================================================
   * Top Pick（アクション候補の最優先）
   * ============================================================ */
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
   * ============================================================ */
  const activeSlot = computed(() => unref(lists.activeSlot))

  const timeslotLabel = computed(() => {
    const s = activeSlot.value
    const map = {
      0: 'いつでも',
      1: '朝',
      2: '昼',
      3: '夕',
      4: '夜',
    }

    if (s == null) return 'すべて'
    return map[s] ?? '—'
  })

  /* ============================================================
   * Progress
   * ============================================================ */
  const progress = computed(() =>
    lists.progress?.value ?? { total: 0, completed: 0 }
  )

  /* ============================================================
   * Export
   * ============================================================ */
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

    /* 操作関数 */
    onUpdate: core.onUpdate,
    getTodayLog: core.getTodayLog,
    isFocused: core.isFocused,
    toggleFocus: core.toggleFocus,
    toggleCollapseDone: core.toggleCollapseDone,

    /* 日付ツール */
    todayYmd: core.todayYmd,
    ymd: core.ymd,
  }
}

export default useTodayTab