// resources/js/composables/usePriority.js
// 「大きいほど高優先度」を返すスコア関数。
// 並び替えは呼び出し側（useTodayTab など）でこのスコアを使って実施する前提。
// スヌーズ方針：スヌーズ中は原則減点。リマインド時刻が近づくと徐々に加点、過ぎたら強めに加点。
import { toSlotNum } from '@/domain/timeutil'

/**
 * computePriority(habit, ctx)
 * ctx（必要なものだけ渡せばOK）
 * {
 *   nowISO: string            // 現在時刻（ISO）
 *   nowSlot: 1|2|3|4          // 現在スロット
 *   snoozedMap: Map<hid, boolean> | Record<number, boolean>
 *   focusedMap: Map<hid, boolean> | Record<number, boolean>
 *   lastDoneISO: Map<hid, ISO> | Record<number, string>
 *   overdueMap: Map<hid, boolean> | Record<number, boolean>
 *   streak: { riskByHabit: Map<hid, number 0..1> | Record<number, number> }
 *   remindAtMap: Map<hid, ISO> | Record<number, string> // 次のリマインド予定（任意）
 *   weight: { ... }            // 重みの上書き（任意）
 * }
 */
export function computePriority(habit, ctx = {}) {
  const w = Object.assign({
    // スロット関連
    slotMatch:         30,   // 現在スロット一致
    anytimePenalty:     -3,  // time_slot=0 は軽く減点

    // 状態
    overdue:           18,   // 当日予定なのに未完了
    focusBoost:        40,   // フォーカス中は強く上げる
    streakRisk:        20,   // 連続未達の危険度（0..1）

    // 経過
    recency:           10,   // 最終達成から日数でじわっと加点

    // スヌーズ（近接は加点、遠い/中は減点）
    snoozedPenalty:   -20,   // スヌーズ中の基礎減点
    remindSoonBoost:   16,   // リマインドが近いと加点（±15分内で最大）
    remindPastBoost:   10,   // リマインド時刻を過ぎていたら追加加点
    remindFarPenalty:   -8,  // 30分以上先なら更に下げる

    // ウィンドウ（分）
    remindSoonWindowMin: 15,
    remindFarWindowMin:  30,

    // 任意の重要度（habit.priority: 数値）→ 0..1 に正規化して加点
    importance:         8,

    // 同点崩し（デフォルト 0：決定的な並びを維持。必要なら ctx.weight で上書き）
    jitter:             0,
  }, ctx.weight || {})

  const now = parseDate(ctx.nowISO) || new Date()
  const id  = Number(habit?.id)
  const slot = toSlotNum(habit?.time_slot ?? 0)

  const focus   = readBool(ctx.focusedMap, id)
  const snoozed = readBool(ctx.snoozedMap, id)
  const overdue = readBool(ctx.overdueMap, id)

  const risk    = readNum(ctx.streak?.riskByHabit, id)
  const lastISO = readStr(ctx.lastDoneISO, id)
  const remindAtISO = readStr(ctx.remindAtMap, id)

  let s = 0

  // 1) 当日未達は優先
  if (overdue) s += w.overdue

  // 2) スロット一致（0:anytime は軽い減点）
  if (slot !== 0 && ctx.nowSlot && slot === ctx.nowSlot) s += w.slotMatch
  if (slot === 0) s += w.anytimePenalty

  // 3) フォーカス
  if (focus) s += w.focusBoost

  // 4) スヌーズ
  if (snoozed) {
    s += w.snoozedPenalty
    s += calcRemindProximity(now, remindAtISO, w)
  }

  // 5) 連続達成リスク（0..1）
  if (isFinite(risk) && risk > 0) s += clamp01(risk) * w.streakRisk

  // 6) 最終達成からの経過（週スケールのシグモイド）
  if (lastISO) {
    const days = daysBetweenISO(lastISO, now)
    s += w.recency * sigmoid(days / 7)
  }

  // 7) 任意 importance（小さい=重要 と解釈して 0..1 に）
  if (typeof habit?.priority === 'number') {
    s += w.importance * normalizeImportance(habit.priority)
  }

  // 8) 同点崩し
  s += Math.random() * w.jitter

  return s
}

/* ========================= ヘルパ ========================= */

// Map でもプレーンオブジェクトでも読めるユーティリティ
function readBool(src, id){
  if (!src) return false
  if (typeof src.get === 'function') return !!src.get(id)
  return !!src[id]
}
function readStr(src, id){
  if (!src) return null
  if (typeof src.get === 'function') return src.get(id) ?? null
  return src[id] ?? null
}
function readNum(src, id){
  const v = readStr(src, id)
  return (typeof v === 'number') ? v : Number(v ?? NaN)
}

function calcRemindProximity(now, iso, w) {
  if (!iso) return 0
  const target = parseDate(iso)
  if (!target) return 0
  const diffMin = (target.getTime() - now.getTime()) / 60000

  // すでに過ぎている
  if (diffMin <= 0) return w.remindPastBoost

  // かなり先ならしっかり減点
  if (diffMin >= w.remindFarWindowMin) return w.remindFarPenalty

  // 近いほどブースト（0分→最大、15分→0）
  const ratio = 1 - clamp01(Math.abs(diffMin) / w.remindSoonWindowMin)
  return w.remindSoonBoost * ratio
}

function normalizeImportance(p){
  // 例: importance=1(高)〜5(低) を 1.0〜0.2 に
  const hi=1, lo=5
  if (p == null) return 0.5
  const clamped = Math.min(Math.max(p, hi), lo)
  return 1 - (clamped - hi) / (lo - hi + 1e-9)
}

function parseDate(iso){
  try {
    if (!iso) return null
    // 'YYYY-MM-DD' 形式はローカル0時扱い
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(iso + 'T00:00:00')
    const d = new Date(iso)
    return isNaN(d) ? null : d
  } catch { return null }
}

function daysBetweenISO(isoA, nowDate){
  const a = parseDate(isoA); const b = nowDate
  if (!a || !b) return 0
  const diff = b.getTime() - a.getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

function sigmoid(x){ return 1/(1+Math.exp(-x)) }
function clamp01(x){ return Math.max(0, Math.min(1, x)) }