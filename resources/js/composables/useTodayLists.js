// resources/js/composables/useTodayLists.js
import { computed } from 'vue'
import { toSlotNum } from '@/domain/timeutil'
import { uiStatus } from '@/domain/progress'
import { computePriority } from './usePriority'

import { useTodayPriority, sortToday } from './useTodayPriority'
import { useTodayAnytime } from './useTodayAnytime'
import { useTodayNextSlot } from './useTodayNextSlot'

/**
 * Today タブ用の派生リスト (topPick / actionable / anytime / nextSlot など)
 * ※ コア状態は useTodayState から渡してもらう
 */
export function createTodayLists(deps) {
  const {
    ui,
    board,
    habits,
    serverNow,
    serverNowSlot,
    apiTopPick,
    nowDateObj,
    todayYmd,
    ymd,
  } = deps

  const getLog = board.getLog.bind(board)

  // 1. 優先度＋現在タブ
  const {
    priorityCtx,
    plannedHabits,
    resolvedTimeslot,
    resolvedTimeslotLabel,
    timeslotLabel,
    actionable,
    actionableOnly,
    done,
  } = useTodayPriority({
    ui,
    board,
    habits,
    serverNow,
    serverNowSlot,
    todayYmd,
  })

  // 2. topPick（priorityCtx に依存）
  const topPick = computed(() => {
    // “すべて”タブ以外では topPick を出さない
    if (resolvedTimeslot.value !== 'all') return null

    // API からの top_pick があれば優先
    if (apiTopPick.value?.habit_id) {
      const h = habits.value.find(x => x.id === Number(apiTopPick.value.habit_id))
      if (h) {
        const log = getLog(h.id, todayYmd(), h.time_slot)
        return { h, log, score: computePriority(h, priorityCtx.value) }
      }
    }

    // フォールバック: 優先度最大のもの
    const candidates = habits.value.filter(h => {
      if (toSlotNum(h.time_slot) === 0) return false
      const log = getLog(h.id, todayYmd(), h.time_slot)
      return uiStatus(h, log) !== 'done'
    })

    const sorted = sortToday(candidates, priorityCtx.value)
    if (!sorted.length) return null

    const h = sorted[0]
    const log = getLog(h.id, todayYmd(), h.time_slot)
    return { h, log, score: computePriority(h, priorityCtx.value) }
  })

  // 3. anytime 系
  const anytimeParts = useTodayAnytime({
    ui,
    board,
    habits,
    serverNow,
    todayYmd,
    priorityCtx,
    sortToday,
  })

  // 4. 次の時間帯
  const nextSlotParts = useTodayNextSlot({
    board,
    habits,
    serverNowSlot,
    nowDateObj,
    todayYmd,
    ymd,
    priorityCtx,
    sortToday,
    resolvedTimeslot,
  })

  return {
    plannedHabits,
    resolvedTimeslot,
    resolvedTimeslotLabel,
    timeslotLabel,
    priorityCtx,
    topPick,
    actionable,
    actionableOnly,
    done,
    ...anytimeParts,
    ...nextSlotParts,
  }
}

// 既存互換：外からはここ経由で sortToday を import できる
export { sortToday } from './useTodayPriority'