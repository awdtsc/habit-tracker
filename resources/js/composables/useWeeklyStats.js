// /resources/js/composables/useWeeklyStats.js
import { ref, watch } from 'vue'
import axios from 'axios'
import { startOfWeek, isoLocal, addDays } from '@/domain/dates'

export function useWeeklyStats() {
  const start = ref(startOfWeek())
  const labels = ref([])
  const rates  = ref([0,0,0,0,0,0,0])
  const loading = ref(false)

  // 競合防止（古いレスポンスの上書き回避）
  let lastReq = 0
  let debounceId = null
  let abortCtrl = null

  async function fetchWeekly() {
    // 古いリクエストをキャンセル
    if (abortCtrl) abortCtrl.abort()
    abortCtrl = new AbortController()

    loading.value = true
    const reqId = ++lastReq
    try {
      const { data } = await axios.get('/achievement/weekly', {
        params: { start: isoLocal(start.value) },
        signal: abortCtrl.signal,
      })
      if (reqId !== lastReq) return // 古いレスポンスは無視
      labels.value = data.labels || data.days || []
      rates.value  = data.rates  || []
    } finally {
      if (reqId === lastReq) loading.value = false
    }
  }

  // 軽いデバウンス
  function refresh() {
    clearTimeout(debounceId)
    debounceId = setTimeout(fetchWeekly, 200)
  }

  // 週の移動API（UIから呼べるようにしておく）
  function setStart(d) { start.value = startOfWeek(d) }
  function nextWeek()  { start.value = addDays(start.value, 7) }
  function prevWeek()  { start.value = addDays(start.value, -7) }
  function thisWeek()  { start.value = startOfWeek(new Date()) }

  // start が変わったら自動で再取得（初回も即時）
  watch(start, refresh, { immediate: true })

  return {
    start, labels, rates, loading,
    fetchWeekly, refresh,
    setStart, nextWeek, prevWeek, thisWeek,
  }
}