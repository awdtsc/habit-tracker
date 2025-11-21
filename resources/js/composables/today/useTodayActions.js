// resources/js/composables/today/useTodayActions.js

import { logKey } from '@/stores/useHabitBoard'
import { toSlotNum } from '@/domain/timeutil'

export function useTodayActions(board, habits, todayYmd, ui, apiTopPick) {

  /* -----------------------------------------
   * applyToggleDiff
   * --------------------------------------- */
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

  /* -----------------------------------------
   * onUpdate：rating更新 or check toggle
   * --------------------------------------- */
  async function onUpdate(payload) {
    if (!payload || payload.id == null) return

    const hid = Number(payload.id)
    const h   = habits.value.find(x => x.id === hid)
    if (!h) return

    const slot    = toSlotNum(h.time_slot ?? 0)
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
        console.error('[TodayActions] rating failed', e)
      }
      return
    }

    /* ----- check toggle ----- */
    const key  = logKey(hid, dateISO, slot)
    const prev = board.state.checks[key]

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
      console.error('[TodayActions] toggle failed', e)

    } finally {
      const cur = { ...(board.state.checks[key] || {}) }
      delete cur.__pending

      board.replaceChecks({
        ...board.state.checks,
        [key]: cur
      })
    }
  }

  return {
    onUpdate,
    applyToggleDiff,
  }
}
