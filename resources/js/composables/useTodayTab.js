// resources/js/composables/useTodayTab.js
import { computed, unref } from 'vue'

/**
 * TodayTab 用の統合ロジック
 * core は useTodayState() の返り値
 */
export function useTodayTab(core) {
  const lists = core.lists

  /* ============================================================
   * Slots / Lists マッピング
   * ============================================================ */

  // 今日やる予定の全習慣
  const plannedHabits = computed(() =>
    lists.plannedHabits?.value ?? []
  )

  // “すべてタブ” の未完了
  const allActionable = computed(() =>
    lists.allActionable?.value ?? []
  )

  // “すべてタブ” の完了
  const allDone = computed(() =>
    lists.allDone?.value ?? []
  )

  // “slotタブ（1〜4）” の未完了
  const slotActionable = computed(() =>
    lists.slotActionable?.value ?? []
  )

  // “slotタブ” の完了
  const slotDone = computed(() =>
    lists.slotDone?.value ?? []
  )

  // anytime（slotタブの時だけ）
  const anytimeActionable = computed(() =>
    lists.anytimeActionable?.value ?? []
  )

  const anytimeDone = computed(() =>
    lists.anytimeDone?.value ?? []
  )

  // 次のスロット
  const nextSlot = computed(() =>
    lists.nextSlot?.value ?? null
  )

  const nextSlotHabits = computed(() =>
    lists.nextSlotHabits?.value ?? []
  )

  /* ============================================================
   * bySlot（Weekly UI など共通用）
   * ============================================================ */
  const bySlot = computed(() =>
    lists.plannedBySlot?.value ?? { 0: [], 1: [], 2: [], 3: [], 4: [] }
  )

  /* ============================================================
   * Top Pick（未完了の中で最も優先度の高いもの）
   * ============================================================ */
  const topPick = computed(() => {
    const source = [
      ...allActionable.value,
      ...slotActionable.value,
    ]

    if (!source.length) return null

    return source[0] // computePriority 済のためソート済み
  })

  /* ============================================================
   * Timeslot ラベル
   * ============================================================ */
  const activeSlot = computed(() =>
    unref(lists.activeSlot)
  )

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
    plannedHabits,
    bySlot,

    /* TodayTab.vue が使う一覧 */
    allActionable,
    allDone,
    slotActionable,
    slotDone,
    anytimeActionable,
    anytimeDone,

    nextSlot,
    nextSlotHabits,
    topPick,

    activeSlot,
    timeslotLabel,
    progress,

    /* 操作 */
    onUpdate: core.onUpdate,
    getTodayLog: core.getTodayLog,
    isFocused: core.isFocused,
    toggleFocus: core.toggleFocus,
    toggleCollapseDone: core.toggleCollapseDone,

    todayYmd: core.todayYmd,
    ymd: core.ymd,
  }
}

export default useTodayTab