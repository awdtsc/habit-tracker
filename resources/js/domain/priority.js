// resources/js/domain/priority.js
// 並び順スコア（降順）。支援/標準/簡易で共通に使える。
export function priorityScore({ habit, log, now, resolvedTimeslot }) {
  let s = 0
  const st = log?.status ?? 'todo'
  if (st === 'done') s -= 20
  if (st === 'skipped') s -= 10

  if (habit?.timeslot === resolvedTimeslot) s += 40
  if (habit?.focus) s += 30

  // snooze期限（過ぎていたら最優先）
  const snoozeTo = log?.snooze_to ? new Date(log.snooze_to) : null
  if (snoozeTo) {
    const diff = snoozeTo.getTime() - now.getTime()
    if (diff <= 0) s += 50
    else if (diff <= 60 * 60 * 1000) s += 25 // 1h以内
  }

  // リマインド時刻が近い
  if (habit?.reminder_time) {
    const [hh, mm] = habit.reminder_time.split(':').map(Number)
    const rt = new Date(now); rt.setHours(hh, mm, 0, 0)
    const delta = rt.getTime() - now.getTime()
    if (delta >= 0 && delta <= 60 * 60 * 1000) s += 25
  }

  // まだ未実施
  if (st !== 'done' && st !== 'skipped') s += 15

  // TODO: 連続日数が切れそう等を加点する場合はここに

  // タイブレーク用の軽いノイズ（安定ソート環境なら不要）
  return s
}