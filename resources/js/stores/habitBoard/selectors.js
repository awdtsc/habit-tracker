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

  // 返り値の器
  const items = []
  const actionable = []
  const done = []

  const bySlot = {
    0: [], 1: [], 2: [], 3: [], 4: []
  }

  let completed = 0
  let total = 0

  // nextSlot 用
  const slotHasHabit = { 1: false, 2: false, 3: false, 4: false }
  let topPick = null
  let topPickSlot = Infinity
  let topPickId = Infinity

  for (const row of rows) {
    const h = row.h || {}
    const id = Number(h.id)

    // slot 正規化 (今日の row.today_log の fallback も含む)
    const rawSlot = h.time_slot ?? row.today_log?.time_slot ?? 0
    const slotNum = toSlotNum(rawSlot)

    // log を取得
    const fromStore = typeof getLog === 'function'
      ? getLog(id, date, slotNum)
      : null

    const log = fromStore || row.today_log || null

    const item = { h: { ...h, id, time_slot: slotNum }, log }

    items.push(item)
    bySlot[slotNum].push(item)

    total++

    // 完了/未完で分類
    const isDone = log?.status === 'done'
    if (isDone) {
      done.push(item)
      completed++
    } else {
      actionable.push(item)

      // topPick の最適化（slot → id の最小を取る）
      if (slotNum < topPickSlot || (slotNum === topPickSlot && id < topPickId)) {
        topPick = item
        topPickSlot = slotNum
        topPickId = id
      }
    }

    // nextSlot チェック用：その slot に何かあるか
    if (slotNum >= 1 && slotNum <= 4) {
      slotHasHabit[slotNum] = true
    }
  }

  // 達成率
  const progress = {
    total,
    completed,
    rate: total === 0 ? 0 : completed / total,
  }

  // nextSlot 計算（nowSlot の次のスロットで習慣があるところ）
  const sNow = Number(nowSlot ?? 1)
  let nextSlot = null
  for (let s = sNow + 1; s <= 4; s++) {
    if (slotHasHabit[s]) {
      nextSlot = s
      break
    }
  }

  return {
    items,
    actionable,
    done,
    bySlot,
    progress,
    nextSlot,
    topPick,
  }
}

/* ============================================================
 * 旧 selectTodayViewModel 互換関数
 * ============================================================ */
export function selectTodayViewModel(args) {
  return buildTodayViewModel(args)
}