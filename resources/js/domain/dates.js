// resources/js/domain/dates.js

// 月曜はじめの週の開始日
export function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const w = d.getDay() || 7 // Mon=1 ... Sun=7
  if (w !== 1) d.setDate(d.getDate() - (w - 1))
  return d
}

// 日付加算（純粋関数）
export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// YYYY-MM-DD（ローカル）に整形
export function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 互換：isoLocal（内部実装は ymd と同じ）
export function isoLocal(d) {
  return ymd(d)
}

// 今日の YYYY-MM-DD を取得（任意の基準日を渡してもOK）
export function todayYmd(base = new Date()) {
  return ymd(base)
}

// d が明日かどうか（ローカル日単位で比較）
export function isTomorrow(d) {
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return (b - a) / 86400000 >= 1
}