// resources/js/composables/sortToday.js
import { priorityScore } from '@/domain/priority'

/**
 * 今日用の並び順：
 * - 未完を先に、完了は後ろ（item.done を利用可）
 * - 次に priorityScore 高い順
 * - 次に time_slot（morning→noon→evening→night）
 * - 最後にタイトル昇順
 *
 * items は Habit か { h: Habit, log?, done? } のどちらでもOK。
 */
const slotWeight = (n) => {
  // 0:anytime は一番後ろに
  if (!n) return 99
  return n // 1<2<3<4
}

export function sortToday(items) {
  const arr = Array.isArray(items) ? [...items] : []

  return arr.sort((A, B) => {
    const a = A && (A.h || A)
    const b = B && (B.h || B)
    const aDone = A && A.done === true
    const bDone = B && B.done === true

    // 1) 未完 → 完了
    if (aDone !== bDone) return aDone ? 1 : -1

    // 2) priorityScore 降順
    const ps = (priorityScore(b) || 0) - (priorityScore(a) || 0)
    if (ps !== 0) return ps

    // 3) time_slot
    const sw = slotWeight(a?.time_slot) - slotWeight(b?.time_slot)
    if (sw !== 0) return sw

    // 4) title 昇順
    const at = (a?.title ?? '').toString().toLowerCase()
    const bt = (b?.title ?? '').toString().toLowerCase()
    return at.localeCompare(bt)
  })
}

export default sortToday