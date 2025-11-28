// resources/js/stores/habitBoard/selectors.js
import { toSlotNum } from '@/domain/timeutil'

/* ============================================================
 * Today ViewModel（progress は作らない）
 * ============================================================ */

export function buildTodayViewModel({
  planned,
  getLog,
  date,
  nowSlot,
}) {
  const rows = Array.isArray(planned) ? planned : []

  const items = []
  const actionable = []
  const done = []

  const bySlot = {
    0: { actionable: [], done: [] },
    1: { actionable: [], done: [] },
    2: { actionable: [], done: [] },
    3: { actionable: [], done: [] },
    4: { actionable: [], done: [] },
  }

  let topPick = null
  let topPickSlot = Infinity
  let topPickId = Infinity

  for (const row of rows) {
    const h = row.h || {}
    const id = Number(h.id)

    const rawSlot = h.time_slot ?? row.today_log?.time_slot ?? 0
    const slotNum = toSlotNum(rawSlot)

    const fromStore = typeof getLog === 'function'
      ? getLog(id, date, slotNum)
      : null

    const log = fromStore || row.today_log || null

    const item = { h: { ...h, id, time_slot: slotNum }, log }

    items.push(item)

    const isDone = log?.status === 'done'

    if (isDone) {
      done.push(item)
      bySlot[slotNum]?.done.push(item)
    } else {
      actionable.push(item)
      bySlot[slotNum]?.actionable.push(item)

      if (slotNum < topPickSlot || (slotNum === topPickSlot && id < topPickId)) {
        topPick = item
        topPickSlot = slotNum
        topPickId = id
      }
    }
  }

  return {
    items,
    actionable,
    done,
    bySlot,
    nextSlot: Number(nowSlot ?? 0) || null,
    topPick,
  }
}

/* ============================================================
 * Legacy wrapper
 * ============================================================ */
export function selectTodayViewModel(args) {
  return buildTodayViewModel(args)
}