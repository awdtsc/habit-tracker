export function usePlanned() {
  function isPlannedOn(h, dateObj) {
    if (h.start_date && new Date(h.start_date) > dateObj) return false
    if (h.end_date && new Date(h.end_date) < dateObj) return false
    if (String(h.frequency_type || '').toLowerCase() === 'daily') return true
    const dow = (dateObj.getDay() || 7) // 1=Mon..7=Sun
    const arr = (h.days_of_week || []).map(Number)
    return arr.includes(dow)
  }
  return { isPlannedOn }
}