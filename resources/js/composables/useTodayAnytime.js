// resources/js/composables/useTodayAnytime.js
import { computed } from 'vue'
import { toSlotNum } from '@/domain/timeutil'
import { pickAnytimeCandidates } from '@/domain/anytime'
import { uiStatus } from '@/domain/progress'

/**
 * anytime 系のリストだけを担当する composable
 */
export function useTodayAnytime(deps) {
  const {
    ui,
    board,
    habits,
    serverNow,
    todayYmd,
    priorityCtx,
    sortToday,
  } = deps

  const getLog = board.getLog

  const anytimeAll = computed(() =>
    habits.value
      .filter(h => toSlotNum(h.time_slot) === 0)
      .map(h => ({ h, log: getLog(h.id, todayYmd(), 0) }))
  )

  const anytime = computed(() => {
    const now      = serverNow.value ? new Date(serverNow.value) : new Date()
    const todayStr = todayYmd()

    const candidates = pickAnytimeCandidates({
      habits: anytimeAll.value.map(x => x.h),
      getTodayLog: (id) => getLog(id, todayStr, 0),
      now,
    })

    const enriched = candidates.map(c =>
      c.h && c.log ? c : { h: c, log: getLog(c.id, todayStr, 0) }
    )
    const filtered = enriched.filter(x => uiStatus(x.h, x.log) !== 'done')

    const sorted = sortToday(filtered.map(x => x.h), priorityCtx.value)
    const logMap = new Map(filtered.map(x => [x.h.id, x.log]))
    return sorted.map(h => ({
      h,
      log: logMap.get(h.id) ?? getLog(h.id, todayStr, 0),
    }))
  })

  const anytimeDisplay = computed(() => {
    const isOne = ui.state.filter.limit === 1
    return isOne ? anytime.value.slice(0, 1) : anytime.value
  })

  const anyDone = computed(() =>
    anytimeAll.value.filter(x => uiStatus(x.h, x.log) === 'done')
  )

  return {
    anytime,
    anytimeDisplay,
    anyDone,
  }
}
