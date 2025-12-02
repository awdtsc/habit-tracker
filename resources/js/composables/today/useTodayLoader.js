// resources/js/composables/today/useTodayLoader.js

import { ref, computed } from 'vue'
import axios from '@/axios'
import { todayYmd as _todayYmd, ymd as _ymd } from '@/domain/dates'
import { toSlotNum } from '@/domain/timeutil'
import { logKey } from '@/stores/useHabitBoard'

export function useTodayLoader(board, focus) {
  const loading       = ref(false)
  const loaded        = ref(false)
  const serverTz      = ref('Asia/Tokyo')
  const serverDate    = ref(null)
  const serverNow     = ref(null)
  const serverNowSlot = ref(1)
  const apiTopPick    = ref(null)
  const habits        = ref([])

  const nowDateObj = computed(() =>
    serverNow.value ? new Date(serverNow.value) : new Date()
  )

  const todayYmd = () =>
    serverDate.value || _todayYmd(nowDateObj.value)

  const ymd = (d) => _ymd(d)

  /* -----------------------------------------
   * fetchToday（初期ロード）
   * --------------------------------------- */
  async function fetchToday() {
    if (loading.value) return
    loading.value = true

    try {
      const { data } = await axios.get('/api/today', {
        withCredentials: true,
      })

      loaded.value        = true
      serverTz.value      = data?.timezone || 'Asia/Tokyo'
      serverDate.value    = data?.date || _todayYmd(new Date())
      serverNow.value     = data?.now  || new Date().toISOString()
      serverNowSlot.value = Number(data?.now_slot ?? 1)
      apiTopPick.value    = data?.top_pick ?? null

      const planned  = Array.isArray(data?.planned) ? data.planned : []
      const todayStr = todayYmd()

      /* Habit 整形 */
      habits.value = planned.map(row => {
        const h  = row.h || {}
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

      /* board 初期化 */
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

    } finally {
      loading.value = false
    }
  }

  return {
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

    fetchToday,
  }
}