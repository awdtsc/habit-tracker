// resources/js/composables/today/useTodayLists.js
import { computed } from 'vue'
import { selectTodayViewModel } from '@/stores/habitBoard/selectors'

export function useTodayLists(ui, habits, board, todayYmd, serverNowSlot) {

  const view = computed(() => {
    return selectTodayViewModel({
      habits: habits.value ?? [],
      board,
      today: todayYmd(),
      serverNowSlot: serverNowSlot.value ?? null,
    })
  })

  /* ============================================================
   * activeSlot（UI の数値をそのまま使う）
   * ========================================================== */
  const activeSlot = computed(() => {
    const v = ui?.state?.filter?.timeslot

    // null / auto (= null) / all (= 0) の扱いを統一
    if (v === null || v === 'auto') return null
    if (v === 'all') return null
    if (v === 0) return null

    // 数値がそのまま来ている場合
    if (typeof v === 'number') return v

    // 互換性：文字列が来ても一応 map
    const map = { morning: 1, noon: 2, evening: 3, night: 4 }
    return map[v] ?? null
  })

  const items          = computed(() => view.value.items)
  const allActionable  = computed(() => view.value.allActionable)
  const allDone        = computed(() => view.value.allDone)

  const anytimeActionable = computed(() => view.value.anytimeActionable)
  const anytimeDone       = computed(() => view.value.anytimeDone)

  const slotActionable = computed(() =>
    activeSlot.value == null
      ? []
      : view.value.bySlot[activeSlot.value]?.actionable ?? []
  )

  const slotDone = computed(() =>
    activeSlot.value == null
      ? []
      : view.value.bySlot[activeSlot.value]?.done ?? []
  )

  const nextSlot       = computed(() => view.value.nextSlot)
  const nextSlotHabits = computed(() =>
    view.value.nextSlot != null ? view.value.bySlot[view.value.nextSlot]?.all ?? [] : []
  )

  const plannedBySlot = computed(() => view.value.bySlot)
  const progress      = computed(() => view.value.progress)

  return {
    items,
    allActionable,
    allDone,
    slotActionable,
    slotDone,
    anytimeActionable,
    anytimeDone,
    nextSlot,
    nextSlotHabits,
    plannedBySlot,
    activeSlot,
    progress,
  }
}
