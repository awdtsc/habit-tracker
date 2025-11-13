// resources/js/domain/timeutil.js

/** 任意の入力を正規化して 'morning'|'noon'|'evening'|'night'|'flex' を返す */
export function normalizeTimeslot(v) {
  if (v == null) return 'flex'

  // 数値なら変換
  const n = Number(v)
  if (!Number.isNaN(n)) {
    const map = ['flex', 'morning', 'noon', 'evening', 'night']
    return map[n] ?? 'flex'
  }

  // 文字列ならそのまま判定
  const s = String(v).toLowerCase()
  const allowed = ['flex','morning','noon','evening','night']
  return allowed.includes(s) ? s : 'flex'
}

/** 任意の入力を数値スロット(0..4)に変換 */
export function toSlotNum(v) {
  const s = normalizeTimeslot(v)
  return { flex:0, morning:1, noon:2, evening:3, night:4 }[s]
}