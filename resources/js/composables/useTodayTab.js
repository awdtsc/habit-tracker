// resources/js/composables/useTodayTab.js

import { computed, unref } from 'vue'
import { createTodayLists } from './useTodayLists'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'

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
   * WeeklyBoard（今日タブの唯一の習慣データ源）
   * ========================================================== */
  const weekly = useWeeklyBoard()

  /* ============================================================
   * createTodayLists
   * ========================================================== */
  const lists = createTodayLists({
    ui: core.ui,

    // WeeklyBoard の習慣を今日タブの唯一のデータ源にする
    habits: computed(() => normalizeArray(weekly.state.habits)),

    // 今日ログ取得処理（WeeklyBoard checks 経由）
    board: {
      getLog(habitId, ymd, slot) {
        const checks = weekly.state.checks ?? []
        return (
          checks.find(
            (c) =>
              c.habit_id === habitId &&
              c.date === ymd &&
              c.time_slot === slot
          ) || null
        )
      },
    },

    serverNowSlot: core.serverNowSlot,
    todayYmd: core.todayYmd,
  })

  /* ============================================================
   * unwrap（Ref → 値）
   * ========================================================== */
  const plannedHabits   = computed(() => normalizeArray(lists.plannedHabits?.value))
  const actionableOnly  = computed(() => normalizeArray(lists.actionableOnly?.value))
  const actionable      = computed(() => normalizeArray(lists.actionable?.value))
  const anytime         = computed(() => normalizeArray(lists.anytime?.value))
  const anytimeDisplay  = computed(() => normalizeArray(lists.anytimeDisplay?.value))
  const nextSlotHabits  = computed(() => normalizeArray(lists.nextSlotHabits?.value))
  const nextSlot        = computed(() => unref(lists.nextSlot?.value) ?? null)
  const done            = computed(() => normalizeArray(lists.done?.value))
  const anyDone         = computed(() => done.value.length > 0)

  /* ============================================================
   * Slot grouping（重要）
   * ========================================================== */
  const bySlot = computed(() => {
    const g = lists.bySlot?.value ?? lists.bySlot ?? null
    return g ?? { 0: [], 1: [], 2: [], 3: [], 4: [] }
  })

  /* ============================================================
   * Top Pick
   * ========================================================== */
  const topPick = computed(() => {
    const source = actionableOnly.value.length
      ? actionableOnly.value
      : plannedHabits.value

    if (!source.length) return null

    return source
      .map((item) => ({
        ...item,
        score: item.h?.priority ?? 0,
      }))
      .sort((a, b) => b.score - a.score)[0]
  })

  /* ============================================================
   * Timeslot（現状固定 all）
   * ========================================================== */
  const resolvedTimeslot      = computed(() => 'all')
  const resolvedTimeslotLabel = computed(() => '全件')

  const timeslotLabel = computed(() => {
    const raw = core.timeslotLabel?.value ?? ''
    return typeof raw === 'string' ? raw : ''
  })

  /* ============================================================
   * Export
   * ========================================================== */
  return {
    ui: core.ui,
    loading: core.loading,
    loaded: core.loaded,

    // 🔥 lists を必ず返す → 今日タブが参照できるようになる
    lists,

    /* 今日タブの習慣（WeeklyBoard のみ） */
    habits: computed(() => normalizeArray(weekly.state.habits)),

    /* リスト系 */
    bySlot,
    plannedHabits,
    actionable,
    actionableOnly,
    anytime,
    anytimeDisplay,
    done,
    anyDone,

    nextSlotHabits,
    nextSlot,

    topPick,

    resolvedTimeslot,
    resolvedTimeslotLabel,
    timeslotLabel,

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