// resources/js/domain/timeutil.js

//------------------------------------------------------------
// ⭐ 新ルール：
//   ・内部処理は 0〜4 の数値だけを使う
//   ・UI 表示は専用の label 関数に任せる
//   ・normalizeTimeslot は “文字列 → 文字列 UI 用”
//   ・toSlotNum が “全入力の正規化（最重要）”
//------------------------------------------------------------


/**
 * 🔧 任意の入力を数値スロット(0..4)に完全正規化する
 *
 * 許容される入力例：
 *   0, 1, 2, 3, 4
 *   "0", "1", …
 *   "morning", "noon", "evening", "night", "anytime"
 *   "flex" → 0
 *
 * 内部データはこの関数の結果のみを使う。
 */
export function toSlotNum(v) {
  if (v == null) return 0;

  // 数値系（"2" など文字列数値も含む）
  const n = Number(v);
  if (!Number.isNaN(n)) {
    // 0〜4 の範囲に丸める
    return Math.min(Math.max(n, 0), 4);
  }

  // 文字列系
  const s = String(v).toLowerCase();

  const map = {
    anytime: 0,
    flex: 0,
    morning: 1,
    noon: 2,
    evening: 3,
    night: 4,
  };
  return map[s] ?? 0;
}


/**
 * 🔧 UI 表示用：数値スロット → ラベルへ
 *
 * TodayHeader / TodayTab / NextSlotSection の UI は
 * この関数だけを参照すればよい。
 */
export function slotLabelFor(num) {
  const n = toSlotNum(num);
  return {
    0: "いつでも",
    1: "朝",
    2: "昼",
    3: "夕",
    4: "夜",
  }[n];
}


/**
 * 🔧 UI 用の “文字列 slottype” が必要な場合だけ使う。
 * （内部では使わない）
 *
 * 'anytime'|'morning'|'noon'|'evening'|'night'
 */
export function normalizeTimeslot(v) {
  const n = toSlotNum(v);
  return ["anytime", "morning", "noon", "evening", "night"][n];
}