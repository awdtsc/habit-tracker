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

function parseDaysOfWeek(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)

  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) return p.map(String)
    } catch {
      return raw.split(',').map(s => s.trim()).filter(Boolean)
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
  if (typeof log.status === 'string')
    return log.status.toLowerCase() === 'done'
  return false
}

/* ============================================================
 * Today Lists - FINAL（A 方式）
 * ========================================================== */
export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNowSlot,
}) {

  /* ----------------------- 今日 ----------------------- */
  const today = computed(() =>
    typeof todayYmd === 'function'
      ? todayYmd()
      : (unref(todayYmd) || '')
  )

  const todayDate = computed(() => {
    const d = new Date(today.value)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })

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

    return arr.map(h => {
      const slot = slotOf(h)
      const log = board?.getLog ? board.getLog(h.id, t, slot) : null
      return { h: { ...h, time_slot: slot }, log }
    })
  })

  const plannedHabits = computed(() =>
    items.value.filter(x => isScheduledToday(x.h))
  )

  /* ============================================================
   * ★ A 方式 activeSlot
   * ========================================================== */

  /**
   * A 方式の定義：
   *
   * 初回：timeslot === "auto" → serverNowSlot（現在の時間帯）
   * 以降：timeslot の値をそのまま使う（= 保存された最後のタブ）
   * 
   * Weekly → Today に戻っても自動で "auto" に戻さない
   */
  const activeSlot = computed(() => {
    const filter = ui?.state?.filter
    if (!filter) return null

    const mode = filter.timeslot

    // ① 初回アクセス = "auto"
    if (mode === 'auto') {
      const s = Number(unref(serverNowSlot))
      return Number.isFinite(s) ? s : null
    }

    // ② 手動選択 = 記録された値
    if (mode === 'all') return null

    const n = Number(mode)
    if (Number.isFinite(n) && n >= 0 && n <= 4) return n

    const map = {
      anytime: 0, morning: 1, noon: 2, evening: 3, night: 4,
    }
    return map[String(mode).toLowerCase()] ?? null
  })

  /* ----------------------- グルーピング ----------------------- */
  const plannedBySlot = computed(() => {
    const g = { 0:[],1:[],2:[],3:[],4:[] }
    for (const x of plannedHabits.value) {
      g[slotOf(x.h)].push(x)
    }
    return g
  })

  const allActionable = computed(() => {
    if (activeSlot.value !== null) return []
    return plannedHabits.value
      .filter(x => !isCompleted(x.h, x.log))
      .sort((a,b) => computePriority(b.h, {}) - computePriority(a.h, {}))
  })

  const allDone = computed(() => {
    if (activeSlot.value !== null) return []
    return plannedHabits.value.filter(x => isCompleted(x.h, x.log))
  })

  const slotActionable = computed(() => {
    const s = activeSlot.value
    if (s == null) return []
    return plannedBySlot.value[s]
      ?.filter(x => !isCompleted(x.h, x.log))
      ?.sort((a,b) => computePriority(b.h,{}) - computePriority(a.h,{}))
      ?? []
  })

  const slotDone = computed(() => {
    const s = activeSlot.value
    if (s == null) return []
    return plannedBySlot.value[s]?.filter(x => isCompleted(x.h, x.log)) ?? []
  })

  const anytimeActionable = computed(() => {
    if (activeSlot.value == null) return []
    return plannedBySlot.value[0]
      .filter(x => !isCompleted(x.h, x.log))
      .sort((a,b) => computePriority(b.h,{}) - computePriority(a.h,{}))
  })

  const anytimeDone = computed(() => {
    if (activeSlot.value == null) return []
    return plannedBySlot.value[0].filter(x => isCompleted(x.h, x.log))
  })

  const nextSlot = computed(() => {
    const cur = Number(unref(serverNowSlot))
    const chain = { 1:2, 2:3, 3:4, 4:null }
    const nxt = Number.isFinite(cur) ? chain[cur] ?? null : null

    if (nxt && plannedBySlot.value[nxt]?.length) {
      return {
        slot: nxt,
        label: ['いつでも','朝','昼','夕','夜'][nxt],
      }
    }
    return null
  })

  const nextSlotHabits = computed(() =>
    nextSlot.value ? plannedBySlot.value[nextSlot.value.slot] : []
  )

  const progress = computed(() => {
    const t = plannedHabits.value.filter(x => slotOf(x.h) !== 0)
    return {
      total: t.length,
      completed: t.filter(x => isCompleted(x.h, x.log)).length,
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