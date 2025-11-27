// resources/js/composables/useTodayLists.js
import { computed } from 'vue'
import { toSlotNum } from '@/domain/timeutil'

export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNowSlot,
}) {

  /* -------------------------------------------------------------
   * 今日の日付（string）
   * ----------------------------------------------------------- */
  const today = (() => {
    if (typeof todayYmd === 'function') return todayYmd()
    return todayYmd?.value ?? ''
  })()

  /* -------------------------------------------------------------
   * 全 items（habit + today_log）
   * ----------------------------------------------------------- */
  const items = computed(() => {
    const list = habits?.value ?? habits ?? []
    return list.map(h => {
      const log = board.getLog(h.id, today, h.time_slot)
      return { h, log }
    })
  })

  /* -------------------------------------------------------------
   * slot grouping（0 = anytime）
   * ----------------------------------------------------------- */
  const bySlot = computed(() => {
    const g = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    for (const x of items.value) {
      const s = toSlotNum(x.h.time_slot)
      g[s].push(x)
    }
    return g
  })

  /* -------------------------------------------------------------
   * 完了判定：status === "done"
   * ----------------------------------------------------------- */
  const filterActionable = (arr) =>
    arr.filter(({ log }) => !(log && log.status === 'done'))

  const filterDone = (arr) =>
    arr.filter(({ log }) => log && log.status === 'done')

  /* -------------------------------------------------------------
   * “すべて” タブ
   * ----------------------------------------------------------- */
  const allActionable = computed(() => filterActionable(items.value))
  const allDone       = computed(() => filterDone(items.value))

  /* -------------------------------------------------------------
   * “スロット別”
   * ----------------------------------------------------------- */
  const slotLists = computed(() => {
    const result = {}

    for (let s = 0; s <= 4; s++) {
      const group = bySlot.value[s] ?? []
      result[s] = {
        actionable: filterActionable(group),
        done      : filterDone(group),
      }
    }
    return result
  })

  return {
    items,
    slotLists,
    allActionable,
    allDone,
  }
}