// resources/js/composables/useTodayTab.js
import { ref, computed, onMounted, watch } from 'vue'
import axios from '@/axios'

import { useUiState } from '@/stores/uiState'
import { useHabitBoard, logKey } from '@/stores/useHabitBoard'
import { useAuthStore } from '@/stores/auth'

// 既存ユーティリティ
import { normalizeTimeslot, toSlotNum } from '@/domain/timeutil'
import { pickAnytimeCandidates } from '@/domain/anytime'
import { uiStatus } from '@/domain/progress'
import { todayYmd as _todayYmd, ymd as _ymd, addDays } from '@/domain/dates'

// 優先度
import { computePriority } from './usePriority'

/* ============================================================================ */
export function sortToday(habits, ctx) {
  const base = {
    nowISO: ctx.nowISO,
    nowSlot: ctx.nowSlot,                 // 1..4
    snoozedMap: ctx.snoozedMap,
    focusedMap: ctx.focusedMap,           // ★ フォーカスも反映
    lastDoneISO: ctx.lastDoneISO,
    overdueMap: ctx.overdueMap,
    streak: ctx.streak,
  }
  return [...habits].sort((a, b) => computePriority(b, base) - computePriority(a, base))
}

/* ============================================================================ */
export function useTodayTab() {
  const auth = useAuthStore()
  const { state, toggle, getLog } = useHabitBoard()
  const ui = useUiState()

  // ---- UIストアの安全初期化 ----
  ui.state = ui.state || {}
  ui.state.filter = ui.state.filter || { timeslot: 'auto', showCompleted: true, showAnytime: true, limit: 0 }
  ui.state.collapse = ui.state.collapse || { done: false }
  if (ui.state.resolvedTimeslot == null) ui.state.resolvedTimeslot = 'morning'

  const loading = ref(false)
  const habits  = ref([])

  // サーバ時間
  const serverTz   = ref('Asia/Tokyo')
  const serverDate = ref(null)  // 'YYYY-MM-DD'
  const serverNow  = ref(null)  // ISO
  const serverNowSlot = ref(1)  // 1..4

  // API の top_pick（存在すれば優先）
  const apiTopPick = ref(null)  // { habit_id, remind_task_id } | null

  // ラッパ（日付）
  const todayYmd = () => serverDate.value || _todayYmd(new Date())
  const ymd      = (d) => _ymd(d)

  /* ---------- フォーカス状態（トグル & 日替わりリセット） ---------- */
  if (!ui.state.focusedByHabit) ui.state.focusedByHabit = {}
  if (!ui.state.focusedAppliedDate) ui.state.focusedAppliedDate = null

  const focusedByHabit = computed({
    get: () => ui.state.focusedByHabit,
    set: v => (ui.state.focusedByHabit = v || {})
  })

  // 日付が変われば自動クリア
  watch(
    () => serverDate.value,
    (d) => {
      if (!d) return
      if (ui.state.focusedAppliedDate && ui.state.focusedAppliedDate !== d) {
        ui.state.focusedByHabit = {}
      }
      ui.state.focusedAppliedDate = d
    },
    { immediate: true }
  )

  function isFocused(id) {
    return !!focusedByHabit.value?.[Number(id)]
  }
  function toggleFocus(id) {
    const k = Number(id)
    const cur = !!focusedByHabit.value[k]
    focusedByHabit.value = { ...focusedByHabit.value, [k]: !cur }
  }
  function toggleCollapseDone() {
    ui.state.collapse = ui.state.collapse || { done: false }
    ui.state.collapse.done = !ui.state.collapse.done
  }

  /* ===== 初期ロード ===== */
  async function loadFromServer() {
    if (!auth.fetchedOnce || !auth.isAuthenticated) return

    loading.value = true
    try {
      const { data } = await axios.get('/api/today', { withCredentials: true })

      serverTz.value      = data?.timezone || 'Asia/Tokyo'
      serverDate.value    = data?.date || _todayYmd(new Date())
      serverNow.value     = data?.now || new Date().toISOString()
      serverNowSlot.value = Number(data?.now_slot ?? 1)
      apiTopPick.value    = data?.top_pick ?? null

      const planned = Array.isArray(data?.planned) ? data.planned : []
      habits.value = planned.map(it => {
        const h = it.h || {}
        return {
          id: Number(h.id),
          title: h.title ?? h.name ?? '',
          name:  h.name ?? h.title ?? '',
          time_slot: toSlotNum(h.time_slot ?? 0),   // 0:anytime
          evaluation_type: h.evaluation ?? 'simple',
          // 表示ラベル用（優先度は focusedMap を参照）
          focus: isFocused(h.id),
        }
      })

      // 返ってきた today_log を state.checks に反映
      for (const it of planned) {
        const h = it.h || {}
        const log = it.today_log || null
        const slotNum = toSlotNum(log?.time_slot ?? h.time_slot ?? 0)
        const key = logKey(Number(h.id), todayYmd(), slotNum)

        if (log) {
          state.checks[key] = {
            status: log.status ?? 'none',
            rating: log.rating ?? 0,
            updated_at: log.updated_at ?? null,
            date: log.date ?? todayYmd(),
          }
        } else {
          state.checks[key] = {
            status: 'none',
            rating: 0,
            updated_at: null,
            date: todayYmd(),
          }
        }
      }
    } catch (e) {
      if (e?.response?.status !== 401) {
        console.error('[TodayTab] /api/today failed', e)
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(loadFromServer)
  watch(
    () => [auth.fetchedOnce, auth.isAuthenticated],
    ([fetchedOnce, isAuthed]) => {
      if (fetchedOnce && isAuthed) loadFromServer()
      if (fetchedOnce && !isAuthed) {
        habits.value = []
        apiTopPick.value = null
      }
    }
  )

  /* ===== 更新ハンドラ（両シグネチャ対応: (habit, payload) / ({id,...})） ===== */
  async function onUpdate(arg1, arg2) {
    // 形を判定
    const hasTwoArgs = !!arg2
    const payload = hasTwoArgs ? arg2 : arg1
    const hid = hasTwoArgs ? Number(arg1?.id) : Number(arg1?.id)

    const h = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot = h.time_slot
    const dateISO = todayYmd()

    // rating or toggle
    if (payload?.rating !== undefined && payload?.rating !== null) {
      try {
        await toggle(h.id, dateISO, 'rating', slot, payload.rating)
      } catch (e) {
        console.error('[todayTab] rating failed', e)
      }
      return
    }

    const key = logKey(h.id, dateISO, slot)
    const prev = state.checks[key]
    state.checks[key] = { ...(prev || {}), __pending: true }

    try {
      await toggle(h.id, dateISO, 'toggle', slot, null)
    } catch (e) {
      console.error('[todayTab] toggle failed', e)
    } finally {
      const cur = state.checks[key]
      if (cur) delete cur.__pending
    }
  }

  /* ===== フィルタ/並び ===== */
  const resolvedTimeslot = computed(() => {
    const raw = ui.state.filter.timeslot === 'auto'
      ? ui.state.resolvedTimeslot
      : ui.state.filter.timeslot
    return raw === 'all' ? 'all' : normalizeTimeslot(raw)
  })

  function matchesTab(h) {
    const tsNum = toSlotNum(h.time_slot)
    if (tsNum === 0) return false
    const cur = resolvedTimeslot.value
    if (cur === 'all') return true
    return tsNum === toSlotNum(cur)
  }

  /* ===== 優先度コンテキスト ===== */
  const priorityCtx = computed(() => {
    const curSlot = Number(serverNowSlot.value || 1)

    const snoozedRaw = (ui.state?.snoozedByHabit) || {}
    const snoozedMap = new Map(Object.entries(snoozedRaw).map(([k,v]) => [Number(k), !!v]))

    const focusedRaw = (ui.state?.focusedByHabit) || {}
    const focusedMap = new Map(Object.entries(focusedRaw).map(([k,v]) => [Number(k), !!v]))

    const lastDoneISO = new Map()
    for (const h of habits.value) {
      const log = getLog(h.id, todayYmd(), h.time_slot)
      lastDoneISO.set(h.id, log?.status === 'done' ? (log?.date ?? todayYmd()) : null)
    }

    const overdueMap = new Map()
    for (const h of habits.value) {
      const log = getLog(h.id, todayYmd(), h.time_slot)
      overdueMap.set(h.id, !!(log && log.status !== 'done' && toSlotNum(h.time_slot) > 0))
    }

    const riskRaw = (ui.state?.streakRiskByHabit) || {}
    const riskByHabit = new Map(Object.entries(riskRaw).map(([k,v]) => [Number(k), Number(v) || 0]))

    return {
      nowISO: serverNow.value || new Date().toISOString(),
      nowSlot: curSlot,
      snoozedMap,
      focusedMap,                 // ★ 追加
      lastDoneISO,
      overdueMap,
      streak: { riskByHabit },
    }
  })

  /* ===== リスト（共通） ===== */
  const plannedHabits = computed(() => habits.value)

  const topPick = computed(() => {
    // “すべて”タブ以外では topPick を出さない
    if (resolvedTimeslot.value !== 'all') return null

    if (apiTopPick.value?.habit_id) {
      const h = habits.value.find(x => x.id === Number(apiTopPick.value.habit_id))
      if (h) {
        const log = getLog(h.id, todayYmd(), h.time_slot)
        return { h, log, score: computePriority(h, priorityCtx.value) }
      }
    }
    const candidates = habits.value.filter(h => {
      if (toSlotNum(h.time_slot) === 0) return false
      const log = getLog(h.id, todayYmd(), h.time_slot)
      return uiStatus(h, log) !== 'done'
    })
    const sorted = sortToday(candidates, priorityCtx.value)
    if (!sorted.length) return null
    const h = sorted[0]
    const log = getLog(h.id, todayYmd(), h.time_slot)
    return { h, log, score: computePriority(h, priorityCtx.value) }
  })

  const actionable = computed(() => {
    const base = plannedHabits.value.filter(matchesTab)
    const sorted = sortToday(base, priorityCtx.value)   // ★ 常に優先度順
    return sorted
      .map(h => ({ h, log: getLog(h.id, todayYmd(), h.time_slot) }))
      .filter(x => uiStatus(x.h, x.log) !== 'done')
  })

  // ★ 変更点：'all' でも limit=1 を適用（以前は !isAll 条件で無効化されていた）
  const actionableOnly = computed(() => {
    const isOne = ui.state.filter.limit === 1
    return isOne ? actionable.value.slice(0, 1) : actionable.value
  })

  const done = computed(() => {
    if (!ui.state.filter.showCompleted) return []
    const base = plannedHabits.value
      .filter(matchesTab)
      .map(h => ({ h, log: getLog(h.id, todayYmd(), h.time_slot) }))
      .filter(x => x.log?.status === 'done')
    // 完了は ID 昇順のまま（必要なら priority 並びに変更可）
    return base.sort((a, b) => (a.h.id | 0) - (b.h.id | 0))
  })

  /* ===== anytime ===== */
  const anytimeAll = computed(() =>
    plannedHabits.value
      .filter(h => toSlotNum(h.time_slot) === 0)
      .map(h => ({ h, log: getLog(h.id, todayYmd(), 0) }))
  )

  const anytime = computed(() => {
    const candidates = pickAnytimeCandidates({
      habits: anytimeAll.value.map(x => x.h),
      getTodayLog: (id) => getLog(id, todayYmd(), 0),
      now: new Date()
    })
    const enriched = candidates.map(c => c.h && c.log ? c : { h: c, log: getLog(c.id, todayYmd(), 0) })
    const filtered = enriched.filter(x => uiStatus(x.h, x.log) !== 'done')

    const sorted = sortToday(filtered.map(x => x.h), priorityCtx.value)
    const logMap = new Map(filtered.map(x => [x.h.id, x.log]))
    return sorted.map(h => ({ h, log: logMap.get(h.id) ?? getLog(h.id, todayYmd(), 0) }))
  })

  // ★ 変更点：'all' でも limit=1 を適用
  const anytimeDisplay = computed(() => {
    const isOne = ui.state.filter.limit === 1
    return isOne ? anytime.value.slice(0, 1) : anytime.value
  })

  const anyDone = computed(() =>
    anytimeAll.value.filter(x => uiStatus(x.h, x.log) === 'done')
  )

  /* ===== 次の時間帯 ===== */
  function currentSlotByNow() {
    const m = {1:'morning',2:'noon',3:'evening',4:'night'}
    return m[serverNowSlot.value] || 'morning'
  }
  function nextOf(slotStr) {
    const order = ['morning','noon','evening','night']
    const cur = normalizeTimeslot(slotStr)
    const i = order.indexOf(cur)
    if (i < 0) return 'morning'
    return i === order.length - 1 ? 'morning' : order[i + 1]
  }

  const baseSlotForNext = computed(() => currentSlotByNow())
  const nextSlot = computed(() => nextOf(baseSlotForNext.value))
  const nextDateObj = computed(() =>
    baseSlotForNext.value === 'night' ? addDays(new Date(), 1) : new Date()
  )
  const nextDateYmd = computed(() => ymd(nextDateObj.value))
  const nextSlotNum = computed(() => toSlotNum(nextSlot.value))

  const showNextSlot = computed(() => {
    const curTab = resolvedTimeslot.value
    const nowSlot = currentSlotByNow()
    return curTab === 'auto' || curTab === nowSlot
  })

  const nextSlotHabits = computed(() => {
    if (!showNextSlot.value) return []
    const list = plannedHabits.value || []
    if (!list.length) return []

    const base = list.filter(h => toSlotNum(h.time_slot) === nextSlotNum.value)

    const ctxNext = {
      ...priorityCtx.value,
      nowISO: new Date(nextDateObj.value).toISOString(),
      nowSlot: nextSlotNum.value
    }

    const sorted = sortToday(base, ctxNext)
    return sorted
      .map(h => {
        const ts = toSlotNum(h.time_slot)
        const log = getLog(h.id, nextDateYmd.value, ts)
        return { h, log }
      })
      .filter(({ h, log }) => uiStatus(h, log) !== 'done')
  })

  /* ===== ラベル ===== */
  const resolvedTimeslotLabel = computed(() =>
    ({ morning:'朝', noon:'昼', evening:'夕', night:'夜', all:'すべて' }[resolvedTimeslot.value] ?? '—')
  )
  function timeslotLabel(v) {
    return ({ morning:'朝', noon:'昼', evening:'夕', night:'夜', flex:'いつでも' }[v] ?? '—')
  }

  function getTodayLog(id) {
    const h = habits.value.find(h => h.id === id)
    const slot = h ? h.time_slot : 0
    return getLog(id, todayYmd(), slot)
  }

  return {
    ui, loading, habits,
    // 主要データ
    plannedHabits, resolvedTimeslot, resolvedTimeslotLabel, timeslotLabel,
    topPick, actionable, actionableOnly, done,
    anytime, anytimeDisplay, anyDone,
    nextSlotHabits, nextSlot,
    // 操作系
    onUpdate, getTodayLog,
    isFocused, toggleFocus, toggleCollapseDone,
    // 時刻系
    todayYmd, ymd,
  }
}

export default useTodayTab
