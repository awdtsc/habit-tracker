// resources/js/composables/useTodayState.js
import { ref, computed } from 'vue'
import axios from '@/axios'

import { useUiState } from '@/stores/uiState'
import { useHabitBoard, logKey } from '@/stores/useHabitBoard'
import { toSlotNum } from '@/domain/timeutil'
import { todayYmd as _todayYmd, ymd as _ymd } from '@/domain/dates'

import { initUiState, createFocusState } from './useTodayUi'
import { createTodayLists } from './useTodayLists'   // ★ Codex 中核

export function useTodayState() {
  const ui    = useUiState()
  const board = useHabitBoard()

  initUiState(ui)

  /* ------------------------------------------------------------
   * State
   * ---------------------------------------------------------- */
  const loading       = ref(false)
  const loaded        = ref(false)
  const habits        = ref([])
  const serverTz      = ref('Asia/Tokyo')
  const serverDate    = ref(null)
  const serverNow     = ref(null)
  const serverNowSlot = ref(1)
  const apiTopPick    = ref(null)

  /* ============================================================
   * dates
   * ========================================================== */
  const nowDateObj = computed(() =>
    serverNow.value ? new Date(serverNow.value) : new Date()
  )

  const todayYmd = () =>
    serverDate.value || _todayYmd(nowDateObj.value)

  const ymd = (d) => _ymd(d)

  const focus = createFocusState(ui, serverDate)

  /* ============================================================
   * TodayLists（TodayTab の全データソース）
   * ========================================================== */
  const lists = createTodayLists({
    ui,
    habits,
    board: { getLog: (id, date, slot) => board.getLog(id, date, slot) },
    todayYmd,
    serverNow,
    serverNowSlot,
  })

  // ★ Codex 仕様（TodayTab から window.__today.items を参照するため）
  const items = computed(() => lists.items?.value ?? lists.items ?? [])

  /* ============================================================
   * applyToggleDiff
   * ========================================================== */
  function applyToggleDiff(diff) {
    if (!diff) return

    const {
      habit_id,
      date,
      time_slot,
      status,
      rating,
      updated_at,
      top_pick,
      today_rate,
    } = diff

    const key = logKey(habit_id, date, time_slot)

    board.state.checks[key] = {
      ...(board.state.checks[key] || {}),
      status:     status ?? board.state.checks[key]?.status ?? 'none',
      rating:     rating ?? board.state.checks[key]?.rating ?? 0,
      updated_at: updated_at ?? new Date().toISOString(),
      date,
      time_slot,
    }

    if (top_pick !== undefined) apiTopPick.value = top_pick
    if (today_rate !== undefined) ui.state.todayRate = today_rate
  }

  /* ============================================================
   * fetchToday（バックエンドから今日の全データを取る）
   * ========================================================== */
  async function fetchToday() {
    if (loading.value) return
    loading.value = true

    try {
      const { data } = await axios.get('/api/today', {
        withCredentials: true,
      })

      loaded.value = true

      serverTz.value      = data?.timezone || 'Asia/Tokyo'
      serverDate.value    = data?.date || _todayYmd(new Date())
      serverNow.value     = data?.now  || new Date().toISOString()
      serverNowSlot.value = Number(data?.now_slot ?? 1)
      apiTopPick.value    = data?.top_pick ?? null

      const planned = Array.isArray(data?.planned) ? data.planned : []
      const todayStr = todayYmd()

      /* -------------------------------------------
       * habits の整形（Codex 指定バージョン）
       * ----------------------------------------- */
      habits.value = planned.map(row => {
        const h = row.h || {}
        const id = Number(h.id)

        return {
          ...h,
          id,
          time_slot: toSlotNum(h.time_slot ?? 0),
          name: h.name ?? h.title ?? '',
          evaluation_type: h.evaluation ?? h.evaluation_type ?? 'simple',
          pending_task: row.pending_task ?? null,
          focus: focus.isFocused(id),
        }
      })

      /* -------------------------------------------
       * board.log の初期化
       * ----------------------------------------- */
      for (const row of planned) {
        const h   = row.h || {}
        const log = row.today_log || null
        const hid = Number(h.id)

        const rawSlot = log?.time_slot ?? h.time_slot ?? 0
        const slotNum = toSlotNum(rawSlot)
        const key     = logKey(hid, todayStr, slotNum)

        board.state.checks[key] = {
          status:     log?.status ?? 'none',
          rating:     log?.rating ?? 0,
          date:       log?.date ?? todayStr,
          time_slot:  slotNum,
          updated_at: log?.updated_at ?? null,
        }
      }

    } catch (e) {
      if (e?.response?.status !== 401) {
        console.error('[TodayState] fetchToday failed', e)
      }
    } finally {
      loading.value = false
    }
  }

  /* ============================================================
   * onUpdate（チェック or 評価の更新）
   * ========================================================== */
  async function onUpdate(payload) {
    if (!payload || payload.id == null) return

    const hid = Number(payload.id)
    const h   = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot    = h.time_slot ?? 0
    const dateISO = todayYmd()

    /* rating 変更 */
    if (payload.rating !== undefined && payload.rating !== null) {
      try {
        const diff = await board.toggle(
          hid,
          dateISO,
          'rating',
          slot,
          payload.rating
        )
        applyToggleDiff(diff)
      } catch (e) {
        console.error('[TodayState] rating failed', e)
      }
      return
    }

    /* toggle */
    const key  = logKey(hid, dateISO, slot)
    const prev = board.state.checks[key]
    board.state.checks[key] = { ...(prev || {}), __pending: true }

    try {
      const diff = await board.toggle(
        hid,
        dateISO,
        'toggle',
        slot,
        null
      )
      applyToggleDiff(diff)
    } catch (e) {
      console.error('[TodayState] toggle failed', e)
    } finally {
      const cur = board.state.checks[key]
      if (cur) delete cur.__pending
    }
  }

  /* ============================================================
   * getTodayLog
   * ========================================================== */
  function getTodayLog(id) {
    const h = habits.value.find(h => h.id === id)
    const slot = h ? h.time_slot : 0
    return board.getLog(id, todayYmd(), slot)
  }

  /* ============================================================
   * export
   * ========================================================== */
  return {
    ui,
    board,
    loading,
    loaded,
    habits,

    items,     // ★ Codex が TodayTab で参照する
    lists,     // ★ useTodayLists の全データ

    serverTz,
    serverDate,
    serverNow,
    serverNowSlot,
    apiTopPick,

    nowDateObj,
    todayYmd,
    ymd,

    ...focus,

    fetchToday,
    onUpdate,
    getTodayLog,
  }
}

export default useTodayState