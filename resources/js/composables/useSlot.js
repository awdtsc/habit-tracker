// 現状の定義：
// 00:00–04:59 night(=4), 05:00–10:59 morning(=1), 11:00–16:59 noon(=2),
// 17:00–20:59 evening(=3), 21:00–23:59 night(=4)
export function getCurrentSlot(date = new Date()) {
  const h = date.getHours()
  if (h <= 4)  return 4;  // night
  if (h <= 10) return 1;  // morning
  if (h <= 16) return 2;  // noon
  if (h <= 20) return 3;  // evening
  return 4;               // night
}

// 任意：特定ISO文字列から判定したいとき
export function slotFromISO(isoTs) {
  return getCurrentSlot(new Date(isoTs))
}