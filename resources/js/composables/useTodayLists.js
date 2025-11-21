// resources/js/composables/useTodayLists.js
import { computed, unref } from 'vue'
import { toSlotNum } from '@/domain/timeutil'
import { computePriority } from './usePriority'

/* ============================================================
 * Slot 正規化
 * ========================================================== */
function slotOf(h) {
  const raw = h?.time_slot

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 0 && raw <= 4 ? raw : 0
  }

  const n = toSlotNum(raw)
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 4) {
    return n
  }

  const map = {
    anytime: 0,
    morning: 1,
    noon: 2,
    evening: 3,
    night: 4,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  }

  const key = String(raw ?? '').toLowerCase()
  return map[key] ?? 0
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
 * Today Lists（完全最終仕様）
 * ========================================================== */
export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNow,
  serverNowSlot,
}) {

  /* ----------------------- today date ----------------------- */
  const today = computed(() =>
    typeof todayYmd === 'function'
      ? todayYmd()
      : unref(todayYmd) || ''
  )

  const todayDate = computed(() => {
    const d = new Date(today.value)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })

  /* ------------------ scheduled filter ------------------ */
  function isScheduledToday(h) {
    const td = todayDate.value

    if (h.start_date && td < new Date(h.start_date)) return false
    if (h.end_date && td > new Date(h.end_date)) return false

    const freq = h.frequency_type || 'daily'
    if (freq === 'daily') return true

    if (freq === 'weekly') {
      const days = parseDaysOfWeek(h.days_of_week)
      const dowKey = weekdayKey(td)
      return days.includes(dowKey)
    }
    return true
  }

  /* ----------------------- items ----------------------- */
  const items = computed(() => {
    const arr = unref(habits) ?? []
    const t = today.value

    return arr.map(h => {
      const slot = slotOf(h)
      const log = board?.getLog ? board.getLog(h.id, t, slot) : null
      return { h: { ...h, time_slot: slot }, log }
    })
  })

  const plannedHabits = computed(() =>
    items.value.filter(x => isScheduledToday(x.h))
  )

  /* ----------------------- filter state ----------------------- */
  const filterState = computed(() =>
    ui?.state?.filter ?? ui?.filter ?? {}
  )

  const activeSlot = computed(() => {
    const mode = filterState.value.timeslot ?? 'auto'

    if (mode === 'auto') {
      const s = Number(unref(serverNowSlot))
      return Number.isFinite(s) ? s : null
    }

    if (mode === 'all') return null

    const direct = Number(mode)
    if (Number.isFinite(direct) && direct >= 0 && direct <= 4) {
      return direct
    }

    const map = {
      anytime: 0, morning: 1, noon: 2, evening: 3, night: 4,
    }
    return map[String(mode).toLowerCase()] ?? null
  })

  /* --------------------- grouping --------------------- */
  const plannedBySlot = computed(() => {
    const g = { 0:[],1:[],2:[],3:[],4:[] }
    for (const x of plannedHabits.value) g[slotOf(x.h)].push(x)
    return g
  })

  /* ================================
   * ここから最重要ロジック
   * ================================ */

  /* ----------------------------------------------------
   * 1. すべてタブ（all）
   * ---------------------------------------------------- */
  const allActionable = computed(() => {
    if (activeSlot.value !== null) return []

    const list = plannedHabits.value
      .filter(x => !isCompleted(x.h, x.log))
      .sort((a, b) =>
        computePriority(b.h, {} ) -
        computePriority(a.h, {} )
      )
    return list
  })

  const allDone = computed(() => {
    if (activeSlot.value !== null) return []

    return plannedHabits.value
      .filter(x => isCompleted(x.h, x.log))
  })

  /* ----------------------------------------------------
   * 2. 個別タブ（slot = 1〜4）
   * ---------------------------------------------------- */
  const slotActionable = computed(() => {
    const slot = activeSlot.value
    if (slot == null) return []

    return plannedBySlot.value[slot]
      .filter(x => !isCompleted(x.h, x.log))
      .sort((a, b) =>
        computePriority(b.h, {}) -
        computePriority(a.h, {})
      )
  })

  const slotDone = computed(() => {
    const slot = activeSlot.value
    if (slot == null) return []

    return plannedBySlot.value[slot]
      .filter(x => isCompleted(x.h, x.log))
  })

  /* ----------------------------------------------------
   * 3. anytime（0番）
   * ---------------------------------------------------- */
  const anytimeActionable = computed(() => {
    if (activeSlot.value == null) return [] // all のときは混ぜるので個別は出さない

    return plannedBySlot.value[0]
      .filter(x => !isCompleted(x.h, x.log))
      .sort((a, b) =>
        computePriority(b.h, {}) -
        computePriority(a.h, {})
      )
  })

  const anytimeDone = computed(() => {
    if (activeSlot.value == null) return []

    return plannedBySlot.value[0]
      .filter(x => isCompleted(x.h, x.log))
  })

  /* ----------------------------------------------------
   * nextSlot（1ステップ）
   * ---------------------------------------------------- */
  const nextSlot = computed(() => {
    const base = Number(unref(serverNowSlot)) || 0
    const next = base + 1
    if (next > 4) return null

    if (plannedBySlot.value[next]?.length) {
      return {
        slot: next,
        label: ['いつでも','朝','昼','夕','夜'][next],
      }
    }
    return null
  })

  const nextSlotHabits = computed(() =>
    nextSlot.value ? plannedBySlot.value[nextSlot.value.slot] : []
  )

  /* ----------------------------------------------------
   * progress（anytime を除外）
   * ---------------------------------------------------- */
  const progress = computed(() => {
    const t = plannedHabits.value.filter(x => slotOf(x.h) !== 0)
    const total = t.length
    const completed = t.filter(x => isCompleted(x.h, x.log)).length
    return { total, completed }
  })

  /* ----------------------------------------------------
   * export
   * ---------------------------------------------------- */
  return {
    activeSlot,

    // all
    allActionable,
    allDone,

    // slot tabs
    slotActionable,
    slotDone,

    // anytime lists
    anytimeActionable,
    anytimeDone,

    // next slot
    nextSlot,
    nextSlotHabits,

    progress,
  }
}

export default createTodayLists
