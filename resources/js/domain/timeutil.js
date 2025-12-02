// resources/js/domain/timeutil.js

/** 任意の入力を正規化して 'anytime'|'morning'|'noon'|'evening'|'night' を返す */
export function normalizeTimeslot(v) {
  if (v == null) return 'anytime';

  // 数値なら変換（0:anytime,1:morning,2:noon,3:evening,4:night）
  const n = Number(v);
  if (!Number.isNaN(n)) {
    const map = ['anytime', 'morning', 'noon', 'evening', 'night'];
    return map[n] ?? 'anytime';
  }

  // 文字列ならそのまま判定（"flex" は anytime のエイリアス）
  const s = String(v).toLowerCase();
  const normalized = s === 'flex' ? 'anytime' : s;

  const allowed = ['anytime', 'morning', 'noon', 'evening', 'night'];
  return allowed.includes(normalized) ? normalized : 'anytime';
}

/** 任意の入力を数値スロット(0..4)に変換 */
export function toSlotNum(v) {
  const s = normalizeTimeslot(v);
  return {
    anytime: 0,
    morning: 1,
    noon: 2,
    evening: 3,
    night: 4,
  }[s];
}