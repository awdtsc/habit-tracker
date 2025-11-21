// resources/js/composables/useTodayState.js
import { ref, computed } from 'vue'
import axios from '@/axios'

import { useUiState } from '@/stores/uiState'
import { useHabitBoard, logKey } from '@/stores/useHabitBoard'
import { toSlotNum } from '@/domain/timeutil'
import { todayYmd as _todayYmd, ymd as _ymd } from '@/domain/dates'

import { initUiState, createFocusState } from './useTodayUi'
import { createTodayLists } from './useTodayLists'   // ← Codex の中核

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
   * TodayLists（TodayTab 全表示データ）
   * ========================================================== */
  const lists = createTodayLists({
    ui,
    habits,
    board,       // ← ★ board 全体を渡す
    todayYmd,
    serverNow,
    serverNowSlot,
  })

  const items = computed(() => lists.items?.value ?? lists.items ?? [])

  /* ============================================================
   * applyToggleDiff (差分を board に反映)
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

    // ★ Codex 指定：イミュータブル置き換え
    board.replaceChecks({
      ...board.state.checks,
      [key]: {
        ...(board.state.checks[key] || {}),
        status:     status ?? board.state.checks[key]?.status ?? 'none',
        rating:     rating ?? board.state.checks[key]?.rating ?? 0,
        updated_at: updated_at ?? new Date().toISOString(),
        date,
        time_slot,
      },
    })

    if (top_pick !== undefined) apiTopPick.value = top_pick
    if (today_rate !== undefined) ui.state.todayRate = today_rate
  }

  /* ============================================================
   * fetchToday（初期ロード）
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
       * habits 整形（Codex 仕様）
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
       * board.checks 初期化（replaceChecks）
       * ----------------------------------------- */
      const nextChecks = {}

      for (const row of planned) {
        const h   = row.h || {}
        const log = row.today_log || null
        const hid = Number(h.id)

        const rawSlot = log?.time_slot ?? h.time_slot ?? 0
        const slotNum = toSlotNum(rawSlot)
        const key     = logKey(hid, todayStr, slotNum)

        nextChecks[key] = {
          status:     log?.status ?? 'none',
          rating:     log?.rating ?? 0,
          date:       log?.date ?? todayStr,
          time_slot:  slotNum,
          updated_at: log?.updated_at ?? null,
        }
      }

      board.replaceChecks(nextChecks)

    } catch (e) {
      if (e?.response?.status !== 401) {
        console.error('[TodayState] fetchToday failed', e)
      }
    } finally {
      loading.value = false
    }
  }

  /* ============================================================
   * onUpdate（check/rating 変更）
   * ========================================================== */
  async function onUpdate(payload) {
    if (!payload || payload.id == null) return

    const hid = Number(payload.id)
    const h   = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot    = h.time_slot ?? 0
    const dateISO = todayYmd()

    /* ----- rating 更新 ----- */
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

    /* ----- check toggle ----- */
    const key  = logKey(hid, dateISO, slot)
    const prev = board.state.checks[key]

    // pending 付与（Codex 方式）
    board.replaceChecks({
      ...board.state.checks,
      [key]: { ...(prev || {}), __pending: true }
    })

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
      // pending 削除
      const cur = { ...(board.state.checks[key] || {}) }
      delete cur.__pending

      board.replaceChecks({
        ...board.state.checks,
        [key]: cur
      })
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

    items,
    lists,

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
