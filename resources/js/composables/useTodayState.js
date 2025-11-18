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

  initUiState(ui)

  const loading       = ref(false)
  const loaded        = ref(false)
  const habits        = ref([])
  const serverTz      = ref('Asia/Tokyo')
  const serverDate    = ref(null)
  const serverNow     = ref(null)
  const serverNowSlot = ref(1)
  const apiTopPick    = ref(null)

  const nowDateObj = computed(() =>
    serverNow.value ? new Date(serverNow.value) : new Date()
  )

  const todayYmd = () =>
    serverDate.value || _todayYmd(nowDateObj.value)

  const ymd = (d) => _ymd(d)

  const focus = createFocusState(ui, serverDate)

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

      habits.value = planned.map(it => {
        const h  = it.h || {}
        const id = Number(h.id)
        return {
          id,
          title: h.title ?? '',
          name:  h.name ?? '',
          time_slot: toSlotNum(h.time_slot ?? 0),
          evaluation_type: h.evaluation ?? 'simple',
          focus: focus.isFocused(id),
        }
      })

      const todayStr = todayYmd()

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

  async function onUpdate(payload) {
    if (!payload || payload.id == null) return

    const hid = Number(payload.id)
    const h   = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot    = h.time_slot ?? 0
    const dateISO = todayYmd()

    if (payload.rating !== undefined && payload.rating !== null) {
      try {
        await board.toggle(hid, dateISO, 'rating', slot, payload.rating)
      } catch (e) {
        console.error('[TodayState] rating failed', e)
      }
      return
    }

    const key = logKey(hid, dateISO, slot)
    const prev = board.state.checks[key]
    board.state.checks[key] = { ...(prev || {}), __pending: true }

    try {
      await board.toggle(hid, dateISO, 'toggle', slot, null)
    } catch (e) {
      console.error('[TodayState] toggle failed', e)
    } finally {
      const cur = board.state.checks[key]
      if (cur) delete cur.__pending
    }
  }

  function getTodayLog(id) {
    const h = habits.value.find(h => h.id === id)
    const slot = h ? h.time_slot : 0
    return board.getLog(id, todayYmd(), slot)
  }

  return {
    ui,                 // ← ★これが欠けてた！！！
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

    ...focus,

    fetchToday,
    onUpdate,
    getTodayLog,
  }
}

export default useTodayState