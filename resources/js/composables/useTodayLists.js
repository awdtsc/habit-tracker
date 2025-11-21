// resources/js/composables/useTodayLists.js
import { computed, unref } from 'vue'
import { toSlotNum } from '@/domain/timeutil'
import { computePriority } from './usePriority'

/* ============================================================
 * Slot 正規化
 * ========================================================== */
function slotOf(h) {
  // 明示的な数値 → そのまま
  if (typeof h?.time_slot === 'number') {
    const n = h.time_slot
    return n >= 0 && n <= 4 ? n : 0
  }

  // toSlotNum が利用可能なら使う
  if (typeof toSlotNum === 'function') {
    const n = toSlotNum(h?.time_slot)
    if (typeof n === 'number' && n >= 0 && n <= 4) return n
  }

  // 文字列 → map で fallback
  const map = {
    anytime: 0, morning: 1, noon: 2, evening: 3, night: 4,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  }
  const v = String(h?.time_slot ?? '').toLowerCase()
  if (map[v] != null) return map[v]

  return 0
}

/* ============================================================
 * Helpers
 * ========================================================== */
function parseDaysOfWeek(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      return raw.split(',').map(s => s.trim()).filter(Boolean)
    }
  }
  return []
}

function weekdayKey(dateObj) {
  return ['sun','mon','tue','wed','thu','fri','sat'][dateObj.getDay()]
}

function isCompleted(h, log) {
  if (!log) return false
  if (log.done != null) return !!log.done
  if (log.status === 'done' || log.status === 1) return true
  if (typeof log.status === 'string') return log.status.toLowerCase() === 'done'
  return false
}

/* ============================================================
 * createTodayLists
 * ========================================================== */
export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNow,
  serverNowSlot,
}) {
  /* 今日の日付 */
  const today = computed(() =>
    typeof todayYmd === 'function' ? todayYmd() : unref(todayYmd) || ''
  )

  const todayDate = computed(() => {
    const d = new Date(today.value)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })

  /* --------------------------------------------------------
   * 今日やるべき習慣か？（start/end + weekly）
   * ------------------------------------------------------ */
  function isScheduledToday(h) {
    const td = todayDate.value

    if (h.start_date) {
      const s = new Date(h.start_date)
      if (td < s) return false
    }

    if (h.end_date) {
      const e = new Date(h.end_date)
      if (td > e) return false
    }

    const freq = h.frequency_type || 'daily'
    if (freq === 'daily') return true

    if (freq === 'weekly') {
      const dowKey = weekdayKey(td)
      const days   = parseDaysOfWeek(h.days_of_week)
      return days.includes(dowKey)
    }

    return true
  }

  /* --------------------------------------------------------
   * items（habit + today_log）
   * ------------------------------------------------------ */
  const items = computed(() => {
    const arr = unref(habits) ?? []
    const t   = today.value

    return arr.map(h => {
      const slot = slotOf(h)
      const log  = board?.getLog ? board.getLog(h.id, t, slot) : null
      return { h: { ...h, time_slot: slot }, log }
    })
  })

  /* 今日の対象（タブ適用前） */
  const plannedHabits = computed(() =>
    items.value.filter(x => isScheduledToday(x.h))
  )

  /* UI State */
  const filterState = computed(() =>
    ui?.state?.filter ?? ui?.filter ?? {}
  )

  const showAnytime = computed(() =>
    filterState.value.showAnytime ?? true
  )

  const showCompleted = computed(() =>
    filterState.value.showCompleted ?? true
  )

  /* --------------------------------------------------------
   * activeSlot（★AUTO モードは serverNowSlot 優先）
   * ------------------------------------------------------ */
  const activeSlot = computed(() => {
    const mode = filterState.value.timeslot ?? 'auto'

    // ★最重要：AUTO → 絶対 serverNowSlot を返す
    if (mode === 'auto') {
      const s = Number(unref(serverNowSlot))
      return Number.isFinite(s) ? s : null
    }

    if (mode === 'all') return null

    if (typeof mode === 'number') return mode

    const map = { morning:1, noon:2, evening:3, night:4, 朝:1, 昼:2, 夕:3, 夜:4 }
    if (map[mode] != null) return map[mode]

    const n = Number(mode)
    return Number.isFinite(n) ? n : null
  })

  /* --------------------------------------------------------
   * filtered（タブ + anytime）
   * ------------------------------------------------------ */
  const filteredHabits = computed(() => {
    const slot = activeSlot.value
    const showAny = showAnytime.value

    return plannedHabits.value.filter(x => {
      const s = slotOf(x.h)

      if (s === 0) return showAny
      if (slot == null) return s >= 1 && s <= 4
      return s === slot
    })
  })

  /* --------------------------------------------------------
   * グルーピング
   * ------------------------------------------------------ */
  const bySlot = computed(() => {
    const g = { 0:[],1:[],2:[],3:[],4:[] }
    for (const x of filteredHabits.value) {
      g[slotOf(x.h)].push(x)
    }
    return g
  })

  const plannedBySlot = computed(() => {
    const g = { 0:[],1:[],2:[],3:[],4:[] }
    for (const x of plannedHabits.value) {
      g[slotOf(x.h)].push(x)
    }
    return g
  })

  /* --------------------------------------------------------
   * actionable / done
   * ------------------------------------------------------ */
  const priorityCtx = computed(() => ({
    nowISO: unref(serverNow),
    nowSlot: Number(unref(serverNowSlot)) ?? null,
    focusedMap: ui?.state?.focusedByHabit,
    snoozedMap: ui?.state?.snoozedByHabit,
  }))

  const actionable = computed(() => {
    const includeCompleted = showCompleted.value
    const slot = activeSlot.value
    const baseList = filteredHabits.value.filter(x => slotOf(x.h) !== 0)

    const list = includeCompleted
      ? baseList
      : baseList.filter(x => !isCompleted(x.h, x.log))

    return [...list].sort(
      (a, b) =>
        computePriority(b.h, priorityCtx.value) -
        computePriority(a.h, priorityCtx.value)
    )
  })

  const done = computed(() =>
    plannedHabits.value.filter(
      x => slotOf(x.h) !== 0 && isCompleted(x.h, x.log)
    )
  )

  /* --------------------------------------------------------
   * Progress（anytime は除外）
   * ------------------------------------------------------ */
  const progress = computed(() => {
    const targets = plannedHabits.value.filter(x => slotOf(x.h) !== 0)
    const total = targets.length
    const completed = targets.filter(x => isCompleted(x.h, x.log)).length
    return { total, completed }
  })

  /* --------------------------------------------------------
   * 次の時間帯（★serverNowSlot 基準）
   * ------------------------------------------------------ */
  const nextSlot = computed(() => {
    const base = Number(unref(serverNowSlot)) || 0

    for (let s = base + 1; s <= 4; s++) {
      if (plannedBySlot.value[s]?.length) {
        return { slot: s, label: ['いつでも','朝','昼','夕','夜'][s] }
      }
    }
    return null
  })

  const nextSlotHabits = computed(() =>
    nextSlot.value
      ? plannedBySlot.value[nextSlot.value.slot] ?? []
      : []
  )

  /* --------------------------------------------------------
   * Export
   * ------------------------------------------------------ */
  return {
    activeSlot,
    plannedHabits,
    filteredHabits,
    bySlot,
    plannedBySlot,
    showAnytime,
    showCompleted,

    anytime: computed(() => bySlot.value[0]),
    actionable,
    done,

    nextSlot,
    nextSlotHabits,
    progress,
  }
}

export default createTodayLists