import { computed } from 'vue'
import { priorityScore } from '@/domain/priority'
import { normalizeTimeslot } from '@/domain/timeutil'
import { toSlotNum } from '@/domain/timeutil'
import { uiStatus } from '@/domain/progress'
import { ymd, addDays } from '@/domain/dates'

function nextOf(slotStr) {
  const order = ['morning','noon','evening','night']
  const cur = normalizeTimeslot(slotStr)
  const i = order.indexOf(cur)
  if (i < 0) return 'morning'
  return i === order.length - 1 ? 'morning' : order[i + 1]
}

export function useNextSlotList({ ui, habitsRef, isPlannedOn, viewLog }) {
  // “次”の基準は常に実時間スロット（ui.state.resolvedTimeslot）
  const baseSlotForNext = computed(() => normalizeTimeslot(ui.state.resolvedTimeslot))
  const nextSlot = computed(() => nextOf(baseSlotForNext.value))
  const nextDateObj = computed(() => baseSlotForNext.value === 'night' ? addDays(new Date(), 1) : new Date())
  const nextDateYmd = computed(() => ymd(nextDateObj.value))
  const nextSlotNum = computed(() => toSlotNum(nextSlot.value))

  const nextSlotHabits = computed(() => {
    const list = habitsRef.value || []
    if (!list.length) return []

    return list
      .filter(h => isPlannedOn(h, nextDateObj.value))
      .filter(h => {
        const ts = Number(h.time_slot ?? 0)
        return ts === nextSlotNum.value || ts === 0 // anytime を含める
      })
      .map(h => {
        const slotForLog = (Number(h.time_slot ?? 0) === 0) ? nextSlotNum.value : Number(h.time_slot)
        const log = viewLog(h.id, nextDateYmd.value, slotForLog)
        return { h, log }
      })
      .filter(({ h, log }) => uiStatus(h, log) !== 'done')
      .map(({ h, log }) => ({ h, log, score: priorityScore({ habit: h, log, now: nextDateObj.value, resolvedTimeslot: nextSlot.value }) }))
      .sort((a, b) => b.score - a.score || (a.h.id|0) - (b.h.id|0))
  })

  return { nextSlot, nextDateObj, nextSlotHabits }
}