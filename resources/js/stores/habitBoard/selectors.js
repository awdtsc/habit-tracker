// resources/js/stores/habitBoard/selectors.js
import { toSlotNum } from '@/domain/timeutil'

/* ============================================================
 * items / actionable / done / bySlot / progress / nextSlot / topPick
 * を１回のループで全部まとめて作る最適化版
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

  let completed = 0
  let total = 0

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

    total++

    const isDone = log?.status === 'done'
    if (isDone) {
      done.push(item)
      completed++
      bySlot[slotNum]?.done.push(item)
    } else {
      actionable.push(item)
      bySlot[slotNum]?.actionable.push(item)

      // topPick: 最も早いスロット & ID の小さいもの
      if (slotNum < topPickSlot || (slotNum === topPickSlot && id < topPickId)) {
        topPick = item
        topPickSlot = slotNum
        topPickId = id
      }
    }
  }

  const progress = {
    total,
    completed,
    done: completed,
    rate: total === 0 ? 0 : completed / total,
  }

  // nowSlot は AUTO 用のデフォルト値として保持（手動切替はコンポーネント側で計算）
  const normalizedNowSlot = Number(nowSlot ?? 0) || null

  return {
    items,
    actionable,
    done,
    bySlot,
    progress,
    nextSlot: normalizedNowSlot,
    topPick,
  }
}

/* ============================================================
 * 旧 selectTodayViewModel 互換関数
 * ============================================================ */
export function selectTodayViewModel(args) {
  return buildTodayViewModel(args)
}
