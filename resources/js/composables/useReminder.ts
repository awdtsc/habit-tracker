import axios from "axios"

export function useReminder() {
  async function remindLater(habitLogId: number, preset: '5m'|'10m'|'1h'|'custom' = '5m', minutes?: number) {
    const payload: any = { habit_log_id: habitLogId, preset }
    if (preset === 'custom' && minutes) payload.minutes = minutes
    const { data } = await axios.post('/api/remind-tasks', payload)
    return data // { ok, task: { id, remind_at, status } }
  }
  return { remindLater }
}