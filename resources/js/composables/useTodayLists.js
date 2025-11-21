// resources/js/composables/useTodayLists.js
import { computed, unref } from 'vue'
import { toSlotNum } from '@/domain/timeutil'
import { computePriority } from './usePriority'

/* ============================================================
 * Slot 正規化
 * ========================================================== */
function slotOf(habit) {
  const raw = habit?.time_slot

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 0 && raw <= 4 ? raw : 0
  }

  const n = toSlotNum(raw)
  if (typeof n === 'number' && n >= 0 && n <= 4) return n

  const map = {
    anytime: 0,
    morning: 1,
    noon: 2,
    evening: 3,
    night: 4,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  }
  return map[String(raw ?? '').toLowerCase()] ?? 0
}

/* ============================================================
 * Helpers
 * ========================================================== */
function parseDaysOfWeek(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)

  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) return p.map(String)
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function weekdayKey(dateObj) {
  return ['sun','mon','tue','wed','thu','fri','sat'][dateObj.getDay()]
}

function isCompleted(_habit, log) {
  if (!log) return false
  if (log.done != null) return !!log.done
  if (log.status === 'done' || log.status === 1) return true
  if (typeof log.status === 'string') return log.status.toLowerCase() === 'done'
  return false
}

/* ============================================================
 * Today Lists - FINAL（A方式）
 * ========================================================== */
export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNowSlot,
}) {

  /* -------------------------------------------
   * ★ board.state.checks をリアクティブ依存に含める
   *    → toggle された瞬間に items → progress まで再計算される
   * ----------------------------------------- */
  const checks = computed(() => board?.state?.checks ?? {})

  /* ----------------------- 今日 ----------------------- */
  const today = computed(() =>
    typeof todayYmd === 'function' ? todayYmd() : unref(todayYmd) || ''
  )

  const todayDate = computed(() => {
    const d = new Date(today.value)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })

  /* 今日やるべき習慣か？ */
  function isScheduledToday(habit) {
    const td = todayDate.value

    if (habit.start_date && td < new Date(habit.start_date)) return false
    if (habit.end_date && td > new Date(habit.end_date)) return false

    const freq = habit.frequency_type || 'daily'
    if (freq === 'daily') return true

    if (freq === 'weekly') {
      const days = parseDaysOfWeek(habit.days_of_week)
      return days.includes(weekdayKey(td))
    }

    return true
  }

  /* ----------------------- items ----------------------- */
  const items = computed(() => {
    const arr = unref(habits) ?? []
    const t = today.value

    // 🔥 checks へ依存させることでリアクティブ更新
    checks.value

    return arr.map((h) => {
      const slot = slotOf(h)
      const log = board?.getLog ? board.getLog(h.id, t, slot) : null
      return { h: { ...h, time_slot: slot }, log }
    })
  })

  const plannedHabits = computed(() =>
    items.value.filter((x) => isScheduledToday(x.h))
  )

  /* ============================================================
   * ★ A方式 activeSlot
   * ========================================================== */
  const activeSlot = computed(() => {
    const filter = ui?.state?.filter
    if (!filter) return null

    const mode = filter.timeslot

    // 初回のみ auto → 現在スロットに変換
    if (mode === 'auto') {
      const s = Number(unref(serverNowSlot))
      return Number.isFinite(s) ? s : null
    }

    if (mode === 'all') return null

    const n = Number(mode)
    if (Number.isFinite(n) && n >= 0 && n <= 4) return n

    const map = {
      anytime: 0,
      morning: 1,
      noon: 2,
      evening: 3,
      night: 4,
    }
    return map[String(mode).toLowerCase()] ?? null
  })

  /* grouping */
  const plannedBySlot = computed(() => {
    const g = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    for (const x of plannedHabits.value) {
      g[slotOf(x.h)].push(x)
    }
    return g
  })

  /* “すべて” タブ */
  const allActionable = computed(() => {
    if (activeSlot.value !== null) return []
    return plannedHabits.value
      .filter((x) => !isCompleted(x.h, x.log))
      .sort((a, b) => computePriority(b.h, {}) - computePriority(a.h, {}))
  })

  const allDone = computed(() => {
    if (activeSlot.value !== null) return []
    return plannedHabits.value.filter((x) => isCompleted(x.h, x.log))
  })

  /* slot タブ */
  const slotActionable = computed(() => {
    const s = activeSlot.value
    if (s == null) return []
    return (
      plannedBySlot.value[s]
        ?.filter((x) => !isCompleted(x.h, x.log))
        ?.sort((a, b) => computePriority(b.h, {}) - computePriority(a.h, {})) ?? []
    )
  })

  const slotDone = computed(() => {
    const s = activeSlot.value
    if (s == null) return []
    return plannedBySlot.value[s]?.filter((x) => isCompleted(x.h, x.log)) ?? []
  })

  /* anytime */
  const anytimeActionable = computed(() => {
    if (activeSlot.value == null) return []
    return plannedBySlot.value[0]
      .filter((x) => !isCompleted(x.h, x.log))
      .sort((a, b) => computePriority(b.h, {}) - computePriority(a.h, {}))
  })

  const anytimeDone = computed(() => {
    if (activeSlot.value == null) return []
    return plannedBySlot.value[0].filter((x) => isCompleted(x.h, x.log))
  })

  /* nextSlot */
  const nextSlot = computed(() => {
    const cur = Number(unref(serverNowSlot))
    const chain = { 1: 2, 2: 3, 3: 4, 4: null }
    const nxt = Number.isFinite(cur) ? chain[cur] ?? null : null

    if (nxt && plannedBySlot.value[nxt]?.length) {
      return {
        slot: nxt,
        label: ['いつでも', '朝', '昼', '夕', '夜'][nxt],
      }
    }
    return null
  })

  const nextSlotHabits = computed(() =>
    nextSlot.value ? plannedBySlot.value[nextSlot.value.slot] : []
  )

  /* ============================================================
   * progress（達成率）
   *
   * 🔥 要求仕様：
   *   - time_slot=0（いつでも）は除外
   *   - それ以外の plannedHabits の中で completed を数える
   * ========================================================== */
  const progress = computed(() => {
    const targets = plannedHabits.value.filter(
      (x) => slotOf(x.h) !== 0   // ⭐ いつでも除外
    )
    return {
      total: targets.length,
      completed: targets.filter((x) => isCompleted(x.h, x.log)).length,
    }
  })

  return {
    items,
    activeSlot,
    plannedHabits,
    plannedBySlot,
    allActionable,
    allDone,
    slotActionable,
    slotDone,
    anytimeActionable,
    anytimeDone,
    nextSlot,
    nextSlotHabits,
    progress,
  }
}
