// resources/js/composables/useTodayState.js
import { ref, computed } from 'vue'
import axios from '@/axios'

import { useUiState } from '@/stores/uiState'
import { useHabitBoard, logKey } from '@/stores/useHabitBoard'
import { toSlotNum } from '@/domain/timeutil'

import { todayYmd as _todayYmd, ymd as _ymd } from '@/domain/dates'
import { initUiState, createFocusState } from './useTodayUi'

export function useTodayState() {
  const ui    = useUiState()
  const board = useHabitBoard()

  // UI の初期化
  initUiState(ui)

  const loading       = ref(false)
  const loaded        = ref(false)
  const habits        = ref([])
  const serverTz      = ref('Asia/Tokyo')
  const serverDate    = ref(null)
  const serverNow     = ref(null)
  const serverNowSlot = ref(1)
  const apiTopPick    = ref(null)

  /* ---------------------------------------
   * 日付系
   * ------------------------------------- */
  const nowDateObj = computed(() =>
    serverNow.value ? new Date(serverNow.value) : new Date()
  )

  const todayYmd = () =>
    serverDate.value || _todayYmd(nowDateObj.value)

  const ymd = (d) => _ymd(d)

  /* ---------------------------------------
   * Focus 状態
   * ------------------------------------- */
  const focus = createFocusState(ui, serverDate)

  /* ---------------------------------------
   * ★ 差分反映：toggle後の高速 UI 更新
   * ------------------------------------- */
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

    // checks に今日の変更を即反映
    board.state.checks[key] = {
      ...(board.state.checks[key] || {}),
      status: status ?? board.state.checks[key]?.status ?? 'none',
      rating: rating ?? board.state.checks[key]?.rating ?? 0,
      updated_at: updated_at ?? new Date().toISOString(),
      date,
      time_slot,
    }

    // TopPick
    if (top_pick !== undefined) {
      apiTopPick.value = top_pick
    }

    // 今日の達成率
    if (today_rate !== undefined) {
      ui.state.todayRate = today_rate
    }
  }

  /* ---------------------------------------
   * 今日タブのデータ読み込み
   * ------------------------------------- */
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

      /* ---------------------------------------
       * ★最重要修正点：
       *   h を「丸ごとコピー + 最低限の正規化」で保持する
       *   → 本来の habit 情報が createTodayLists に渡る
       * ------------------------------------- */
      habits.value = planned.map(it => {
        const h  = it.h || {}
        const id = Number(h.id)

        return {
          ...h,                              // ★ habit情報を丸ごと持つ
          id,
          time_slot: toSlotNum(h.time_slot ?? 0),
          evaluation_type: h.evaluation ?? h.evaluation_type ?? 'simple',
          focus: focus.isFocused(id),
        }
      })

      /* ---------------------------------------
       * 今日のログを board.state.checks に同期
       * ------------------------------------- */
      for (const it of planned) {
        const h   = it.h || {}
        const log = it.today_log || null
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

  /* ---------------------------------------
   * TodayTab → onUpdate
   * ここも差分方式で“超高速”
   * ------------------------------------- */
  async function onUpdate(payload) {
    if (!payload || payload.id == null) return

    const hid = Number(payload.id)
    const h   = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot    = h.time_slot ?? 0
    const dateISO = todayYmd()

    // --- Rating 更新 ---
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

    // --- Toggle 更新 ---
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

  /* ---------------------------------------
   * 今日の log を取得
   * ------------------------------------- */
  function getTodayLog(id) {
    const h = habits.value.find(h => h.id === id)
    const slot = h ? h.time_slot : 0
    return board.getLog(id, todayYmd(), slot)
  }

  /* ---------------------------------------
   * 返却
   * ------------------------------------- */
  return {
    ui,
    board,
    loading,
    loaded,
    habits,
    serverTz,
    serverDate,
    serverNow,
    serverNowSlot,
    apiTopPick,
    nowDateObj,
    todayYmd,
    ymd,

    // Focus API
    ...focus,

    // Methods
    fetchToday,
    onUpdate,
    getTodayLog,
  }
}

export default useTodayState