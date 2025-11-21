// resources/js/composables/today/useTodayLists.js

import { computed } from 'vue'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayLists(ui, habits, board, todayYmd, serverNowSlot) {

  const today = todayYmd()

  /* ============================================================
   * 1. items（habit + log）
   * ========================================================== */
  const items = computed(() => {
    const arr = habits.value ?? []
    return arr.map(h => {
      const log = board.getLog(h.id, today, h.time_slot)
      return { h, log }
    })
  })

  /* ============================================================
   * 2. activeSlot 判定
   * ========================================================== */
  const activeSlot = computed(() => {
    const v = ui?.state?.filter?.timeslot

    if (!v || v === 'auto' || v === 'all') return null

    const map = {
        morning: 1,
        noon: 2,
        evening: 3,
        night: 4,
    }

    return map[v] ?? null
    })
    
  /* ============================================================
   * 3. 今日対象判定（必要ならロジック追加）
   * ========================================================== */
  const plannedHabits = computed(() => {
    return items.value
  })

  /* ============================================================
   * 4. 未完了 / 完了 仕分け
   * ========================================================== */
  const actionable = computed(() =>
    plannedHabits.value.filter(x => x.log?.status !== 'done')
  )

  const done = computed(() =>
    plannedHabits.value.filter(x => x.log?.status === 'done')
  )

  /* ============================================================
   * 5. スロット毎の分類
   * ========================================================== */
  const bySlot = computed(() => {
    const g = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    for (const x of plannedHabits.value) {
      const s = toSlotNum(x.h.time_slot)
      g[s].push(x)
    }
    return g
  })

  /* anytime = 0 */
  const anytimeActionable = computed(() =>
    actionable.value.filter(x => x.h.time_slot === 0)
  )
  const anytimeDone = computed(() =>
    done.value.filter(x => x.h.time_slot === 0)
  )

  /* slot = 1〜4 */
  const slotActionable = computed(() =>
    activeSlot.value == null
      ? []
      : actionable.value.filter(x => x.h.time_slot === activeSlot.value)
  )
  const slotDone = computed(() =>
    activeSlot.value == null
      ? []
      : done.value.filter(x => x.h.time_slot === activeSlot.value)
  )

  /* ============================================================
   * 6. “すべて（未完了）” 用
   * ========================================================== */
  const allActionable = computed(() =>
    activeSlot.value == null ? actionable.value : []
  )
  const allDone = computed(() =>
    activeSlot.value == null ? done.value : []
  )

  /* ============================================================
   * 7. nextSlot
   * ========================================================== */
  const nextSlot = computed(() => {
    if (activeSlot.value != null) return null

    let s = Number(serverNowSlot.value ?? 1)
    if (s < 4) s++
    else return null

    // 次スロットに習慣がなければ表示しない
    if (!bySlot.value[s]?.length) return null
    return s
  })

  const nextSlotHabits = computed(() =>
    nextSlot.value ? bySlot.value[nextSlot.value] : []
  )

  /* ============================================================
   * 8. progress（達成率）
   * ========================================================== */
  const progress = computed(() => {
    const total = plannedHabits.value.length
    const completed = done.value.length

    return {
      total,
      completed,
      rate: total === 0 ? 0 : completed / total,
    }
  })

  /* ============================================================
   * 返却
   * ========================================================== */
  return {
    items,

    /* 今日対象 */
    plannedHabits,

    /* すべてタブ */
    allActionable,
    allDone,

    /* スロットタブ */
    slotActionable,
    slotDone,

    /* anytime */
    anytimeActionable,
    anytimeDone,

    /* next slot */
    nextSlot,
    nextSlotHabits,

    /* slot grouping */
    plannedBySlot: bySlot,
    activeSlot,

    /* progress */
    progress,
  }
}
