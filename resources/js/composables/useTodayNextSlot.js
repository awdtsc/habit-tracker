// resources/js/composables/useTodayNextSlot.js
import { computed } from 'vue'
import { normalizeTimeslot, toSlotNum } from '@/domain/timeutil'
import { addDays } from '@/domain/dates'
import { uiStatus } from '@/domain/progress'

/**
 * 「次の時間帯」のリストだけを担当する composable
 */
export function useTodayNextSlot(deps) {
  const {
    board,
    habits,
    serverNowSlot,
    nowDateObj,
    todayYmd, // 直接は使わないが署名合わせで残しておいてもOK
    ymd,
    priorityCtx,
    sortToday,
    resolvedTimeslot,
  } = deps

  const getLog = board.getLog

  function currentSlotByNow() {
    const map = { 1: 'morning', 2: 'noon', 3: 'evening', 4: 'night' }
    return map[serverNowSlot.value] || 'morning'
  }
  function nextOf(slotStr) {
    const order = ['morning', 'noon', 'evening', 'night']
    const cur = normalizeTimeslot(slotStr)
    const i = order.indexOf(cur)
    if (i < 0) return 'morning'
    return i === order.length - 1 ? 'morning' : order[i + 1]
  }

  const baseSlotForNext = computed(() => currentSlotByNow())
  const nextSlot = computed(() => nextOf(baseSlotForNext.value))

  const nextDateObj = computed(() => {
    const base = nowDateObj.value
    return baseSlotForNext.value === 'night' ? addDays(base, 1) : base
  })

  const nextDateYmd = computed(() => ymd(nextDateObj.value))
  const nextSlotNum = computed(() => toSlotNum(nextSlot.value))

  const showNextSlot = computed(() => {
    const curTab = resolvedTimeslot.value
    const nowSlot = currentSlotByNow()
    return curTab === 'auto' || curTab === nowSlot
  })

  const nextSlotHabits = computed(() => {
    if (!showNextSlot.value) return []
    const list = habits.value || []
    if (!list.length) return []

    const base = list.filter(h => toSlotNum(h.time_slot) === nextSlotNum.value)

    const ctxNext = {
      ...priorityCtx.value,
      nowISO: nextDateObj.value.toISOString(),
      nowSlot: nextSlotNum.value,
    }

    const sorted = sortToday(base, ctxNext)
    return sorted
      .map(h => {
        const ts  = toSlotNum(h.time_slot)
        const log = getLog(h.id, nextDateYmd.value, ts)
        return { h, log }
      })
      .filter(({ h, log }) => uiStatus(h, log) !== 'done')
  })

  return {
    nextSlot,
    nextSlotHabits,
  }
}
