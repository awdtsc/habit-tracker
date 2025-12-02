import { reactive } from 'vue'
import { logKey } from '@/stores/useHabitBoard'

export function useViewLogs({ getLog }) {
  // key -> { value, rating }
  const pendingDesired = reactive(new Map())

  function viewLog(id, dateISO, slot) {
    const base = getLog(id, dateISO, slot) || { status: 'none', rating: null }
    const key = logKey(id, dateISO, slot)
    if (pendingDesired.has(key)) {
      const p = pendingDesired.get(key)
      return { ...base, status: p.value ? 'done' : 'none', rating: p.rating ?? base.rating, _pending: true }
    }
    return base
  }

  function setPending(id, dateISO, slot, value, rating = null) {
    const key = logKey(id, dateISO, slot)
    pendingDesired.set(key, { value, rating })
  }
  function clearPending(id, dateISO, slot) {
    const key = logKey(id, dateISO, slot)
    pendingDesired.delete(key)
  }

  return { viewLog, setPending, clearPending, pendingDesired }
}