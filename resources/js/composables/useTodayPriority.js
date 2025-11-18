// resources/js/composables/useTodayPriority.js
import { computed } from 'vue'
import { normalizeTimeslot, toSlotNum } from '@/domain/timeutil'
import { uiStatus } from '@/domain/progress'
import { computePriority } from './usePriority'

/** 共通ソート */
export function sortToday(habits, ctx) {
  const base = {
    nowISO: ctx.nowISO,
    nowSlot: ctx.nowSlot,
    snoozedMap: ctx.snoozedMap,
    focusedMap: ctx.focusedMap,
    lastDoneISO: ctx.lastDoneISO,
    overdueMap: ctx.overdueMap,
    streak: ctx.streak,
  }
  return [...habits].sort((a, b) => computePriority(b, base) - computePriority(a, base))
}

/** 優先度コンテキストを 1 箇所に集約 */
function createPriorityContext({ habits, getLog, ui, serverNow, serverNowSlot, todayYmd }) {
  return computed(() => {
    const curSlot = Number(serverNowSlot.value || 1)

    const snoozedRaw = ui.state?.snoozedByHabit || {}
    const snoozedMap = new Map(
      Object.entries(snoozedRaw).map(([k, v]) => [Number(k), !!v])
    )

    const focusedRaw = ui.state?.focusedByHabit || {}
    const focusedMap = new Map(
      Object.entries(focusedRaw).map(([k, v]) => [Number(k), !!v])
    )

    const lastDoneISO = new Map()
    const overdueMap  = new Map()
    const todayStr    = todayYmd()

    for (const h of habits.value) {
      const slot = h.time_slot
      const log  = getLog(h.id, todayStr, slot)

      if (log?.status === 'done') {
        lastDoneISO.set(h.id, log.date ?? todayStr)
      } else {
        lastDoneISO.set(h.id, null)
      }

      const isOverdue = !!(log && log.status !== 'done' && toSlotNum(h.time_slot) > 0)
      overdueMap.set(h.id, isOverdue)
    }

    const riskRaw = ui.state?.streakRiskByHabit || {}
    const riskByHabit = new Map(
      Object.entries(riskRaw).map(([k, v]) => [Number(k), Number(v) || 0])
    )

    return {
      nowISO: serverNow.value || new Date().toISOString(),
      nowSlot: curSlot,
      snoozedMap,
      focusedMap,
      lastDoneISO,
      overdueMap,
      streak: { riskByHabit },
    }
  })
}

/** 習慣が現在のタブに含まれるか（時間帯フィルタ） */
function createMatchesTab(resolvedTimeslot) {
  return function matchesTab(h) {
    const tsNum = toSlotNum(h.time_slot)
    if (tsNum === 0) return false // flex(anytime) は別扱い
    const cur = resolvedTimeslot.value
    if (cur === 'all') return true
    return tsNum === toSlotNum(cur)
  }
}

/**
 * 優先度まわり＋「現在タブ」のリストをまとめる composable
 */
export function useTodayPriority(deps) {
  const {
    ui,
    board,
    habits,
    serverNow,
    serverNowSlot,
    todayYmd,
  } = deps

  const getLog = board.getLog

  /* ===== フィルタ/タブ ===== */
  const resolvedTimeslot = computed(() => {
    const raw = ui.state.filter.timeslot === 'auto'
      ? ui.state.resolvedTimeslot
      : ui.state.filter.timeslot
    return raw === 'all' ? 'all' : normalizeTimeslot(raw)
  })

  const resolvedTimeslotLabel = computed(() =>
    ({ morning: '朝', noon: '昼', evening: '夕', night: '夜', all: 'すべて' }[resolvedTimeslot.value] ?? '—')
  )
  function timeslotLabel(v) {
    return ({ morning: '朝', noon: '昼', evening: '夕', night: '夜', flex: 'いつでも' }[v] ?? '—')
  }

  const matchesTab = createMatchesTab(resolvedTimeslot)

  /* ===== 優先度コンテキスト ===== */
  const priorityCtx = createPriorityContext({
    habits,
    getLog,
    ui,
    serverNow,
    serverNowSlot,
    todayYmd,
  })

  /* ===== ベースリスト ===== */
  const plannedHabits = computed(() => habits.value)

  /* ===== 現在タブの「すべき」 ===== */
  const actionable = computed(() => {
    const base   = plannedHabits.value.filter(matchesTab)
    const sorted = sortToday(base, priorityCtx.value)
    return sorted
      .map(h => ({ h, log: getLog(h.id, todayYmd(), h.time_slot) }))
      .filter(x => uiStatus(x.h, x.log) !== 'done')
  })

  const actionableOnly = computed(() => {
    const isOne = ui.state.filter.limit === 1
    return isOne ? actionable.value.slice(0, 1) : actionable.value
  })

  /* ===== 現在タブの「完了」 ===== */
  const done = computed(() => {
    if (!ui.state.filter.showCompleted) return []
    const base = plannedHabits.value
      .filter(matchesTab)
      .map(h => ({ h, log: getLog(h.id, todayYmd(), h.time_slot) }))
      .filter(x => x.log?.status === 'done')

    // 完了は ID 昇順のまま（必要なら priority 並びに変更可）
    return base.sort((a, b) => (a.h.id | 0) - (b.h.id | 0))
  })

  return {
    sortToday,
    priorityCtx,
    plannedHabits,
    resolvedTimeslot,
    resolvedTimeslotLabel,
    timeslotLabel,
    actionable,
    actionableOnly,
    done,
  }
}