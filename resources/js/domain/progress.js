// resources/js/domain/progress.js

// percent 0..1
export function progress(habit, log) {
  const st = log?.status ?? 'none'
  if (st === 'done') return 1
  if (st === 'skipped') return 0

  // 自己評価型
  if (habit?.evaluation_type === 'self') {
    return clamp((log?.rating ?? 0) / 4)  // 0〜4を0〜1に正規化
  }

  switch (habit?.type) {
    case 'counter':
      return clamp((log?.actual_value ?? 0) / Math.max(1, habit?.target_value ?? 1))
    case 'duration':
      return clamp((log?.minutes ?? 0) / Math.max(1, habit?.target_value ?? 1))
    case 'checklist':
      return clamp((log?.checked_items ?? 0) / Math.max(1, habit?.target_value ?? 1))
    default:
      return 0  // ← status=done以外は0にする
  }
}

export function uiStatus(habit, log) {
  const st = log?.status ?? 'none'

  // status が done なら常に done
  if (st === 'done') return 'done'

  // snoozed や skipped はそのまま
  if (st === 'snoozed' || st === 'skipped') return st

  // 自己評価型: rating の値で分岐
  if (habit?.evaluation_type === 'self' || habit?.type === 'rating') {
    const r = log?.rating ?? 0
    if (r >= 4) return 'done'
    if (r >= 1) return 'inprogress'   // ★ 追加: rating 1〜3は進行中
    return 'none'
  }

  // 他のタイプも進捗率で判断せず、done 以外は none
  return 'none'
}

function clamp(x) {
  return Math.max(0, Math.min(1, Number(x) || 0))
}

export function isDone(habit, log) {
  if (!log) return false

  if (habit?.evaluation_type === 'self') {
    // 自己評価型は rating>=4 で完了、1〜3は進行中
    return (log.status === 'done') || ((log.rating ?? 0) >= 4)
  }

  // simple 型ほかは status だけを見る
  return log.status === 'done'
}

export function isFresh(log) {
  if (!log) return false
  const updated = new Date(log.updated_at)
  const today = new Date()
  return updated.toDateString() === today.toDateString()
}