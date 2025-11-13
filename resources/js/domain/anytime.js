// resources/js/domain/anytime.js
import { normalizeTimeslot, toSlotNum } from '@/domain/timeutil'

/**
 * 「いつでも (flex)」候補を返す。
 * - time_slot が 0（数値）または normalizeTimeslot(...) が 'flex' のものだけ対象
 * - 既に done / skipped は候補から除外
 * - 返り値は { h, log, score }[] （未完のみ）
 */
export function pickAnytimeCandidates({ habits, getTodayLog, now = new Date() }) {
  const flex = []

  for (const h of habits) {
    // "いつでも" 判定（互換：time_slot が 0 か、正規化が 'flex'）
    const isFlex =
      toSlotNum(h.time_slot) === 0 ||
      normalizeTimeslot(h.time_slot) === 'flex'
    if (!isFlex) continue

    const log = getTodayLog(h.id)
    const st = log?.status ?? 'none'

    // 完了・スキップは候補外
    if (st === 'done' || st === 'skipped') continue

    // ------- スコアリング -------
    let s = 0

    // 明示フォーカス
    if (h.focus) s += 35

    // その日の提示回数（quota 未達なら優先）
    const quota = h.daily_quota ?? 1
    const prompted = Number(log?.prompted_count ?? 0)
    if (prompted < quota) s += 25

    // 最終提示からの経過時間（長いほど優先）
    const lp = log?.last_prompted_at ? new Date(log.last_prompted_at) : null
    if (!lp) {
      s += 20
    } else {
      const hours = (now - lp) / 36e5
      if (hours > 24) s += 20
      else if (hours > 12) s += 12
    }

    // 一時的に隠す指定
    if (log?.hide_until && new Date(log.hide_until) > now) s -= 20

    // スヌーズ中は微増
    if (st === 'snoozed') s += 5

    flex.push({ h, log, score: s })
  }

  // スコア降順
  flex.sort((a, b) => b.score - a.score)
  return flex // 未完 anytime だけ返す
}