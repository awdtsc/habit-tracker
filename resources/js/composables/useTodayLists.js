// resources/js/composables/useTodayLists.js
import { computed } from 'vue'
import { toSlotNum } from '@/domain/timeutil'

export function createTodayLists({
  ui,
  habits,
  board,
  todayYmd,
  serverNowSlot,
}) {
  /* -------------------------------------------------------
   * 今日の日付（リアクティブ）
   * ----------------------------------------------------- */
  const today = computed(() => {
    if (typeof todayYmd === 'function') return todayYmd()
    return todayYmd?.value ?? todayYmd ?? ''
  })

  const todayDate = computed(() => {
    const d = new Date(today.value)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })

  /* -------------------------------------------------------
   * 全 items（habit + log）
   * ----------------------------------------------------- */
  const items = computed(() => {
    const arr = habits?.value ?? habits ?? []
    const t = today.value

    return arr.map(h => {
      const log = board.getLog(h.id, t, h.time_slot)
      return { h, log }
    })
  })

  /* -------------------------------------------------------
   * 今日やるべき習慣判定
   * ----------------------------------------------------- */
  function isScheduledToday(h) {
    const td = todayDate.value

    // 開始日・終了日
    if (h.start_date) {
      const s = new Date(h.start_date)
      if (td < s) return false
    }
    if (h.end_date) {
      const e = new Date(h.end_date)
      if (td > e) return false
    }

    const freq = h.frequency_type || 'daily'

    if (freq === 'daily') return true

    if (freq === 'weekly') {
      const dowIdx = td.getDay() // 0(日)〜6(土)
      const dowKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dowIdx]

      let days = h.days_of_week

      if (!days) return false

      // 文字列・JSON両対応
      if (typeof days === 'string') {
        try {
          const parsed = JSON.parse(days)
          if (Array.isArray(parsed)) {
            days = parsed
          } else {
            days = days.split(',').map(s => s.trim()).filter(Boolean)
          }
        } catch {
          days = days.split(',').map(s => s.trim()).filter(Boolean)
        }
      }

      if (Array.isArray(days)) {
        return days.includes(dowKey)
      }

      return false
    }

    // それ以外のタイプはとりあえず「表示する」
    return true
  }

  /* -------------------------------------------------------
   * 今日の予定習慣（タブフィルタ前の「全体」）
   * ----------------------------------------------------- */
  const plannedHabits = computed(() =>
    items.value.filter(x => isScheduledToday(x.h))
  )

  /* -------------------------------------------------------
   * スロット正規化（0..4）
   * ----------------------------------------------------- */
  function slotOf(h) {
    // timeutil の変換をまず使う
    const n = toSlotNum?.(h.time_slot)
    if (typeof n === 'number' && n >= 0 && n <= 4) return n

    // 念のための保険
    const v = h.time_slot
    if (typeof v === 'number') return Math.min(Math.max(v, 0), 4)

    const map = {
      anytime: 0,
      morning: 1,
      noon: 2,
      evening: 3,
      night: 4,
      '0': 0,
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
    }
    if (typeof v === 'string' && map[v] != null) return map[v]

    return 0
  }

  /* -------------------------------------------------------
   * タブ状態 → activeSlot
   *  ui.slot:
   *   - 'auto' : 現在スロット(serverNowSlot)
   *   - 'all'  : すべて
   *   - 1..4   : 朝/昼/夕/夜
   * ----------------------------------------------------- */
  const activeSlot = computed(() => {
    const mode = ui?.slot ?? 'auto'

    if (mode === 'all') return null

    if (mode === 'auto') {
      const s = serverNowSlot?.value ?? serverNowSlot ?? 0
      return s || null
    }

    if (typeof mode === 'number') return mode

    const map = { morning: 1, noon: 2, evening: 3, night: 4 }
    return map[mode] ?? null
  })

  /* -------------------------------------------------------
   * anytime の表示フラグ
   * （ui.showAnytime / ui.filter.showAnytime のどちらか）
   * ----------------------------------------------------- */
  const showAnytime = computed(() => {
    if (typeof ui?.showAnytime === 'boolean') return ui.showAnytime
    if (ui?.filter && typeof ui.filter.showAnytime === 'boolean') {
      return ui.filter.showAnytime
    }
    return true
  })

  /* -------------------------------------------------------
   * タブ＆「いつでも表示」適用後の習慣リスト
   *  → ここが「そのタブで見る世界」
   * ----------------------------------------------------- */
  const filteredHabits = computed(() => {
    const slot = activeSlot.value
    const showAny = showAnytime.value

    return plannedHabits.value.filter(x => {
      const s = slotOf(x.h)

      // anytime
      if (s === 0) {
        return showAny
      }

      // すべてタブ → スロットで絞らない
      if (slot == null) return true

      // 個別スロット → そのスロットだけ
      return s === slot
    })
  })

  /* -------------------------------------------------------
   * Slot grouping（朝・昼・夕・夜・anytime）
   *  ※ すでにタブのフィルタを適用した後の世界
   * ----------------------------------------------------- */
  const bySlot = computed(() => {
    const group = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    for (const x of filteredHabits.value) {
      const s = slotOf(x.h)
      if (s >= 0 && s <= 4) group[s].push(x)
    }
    return group
  })

  /* -------------------------------------------------------
   * anytime / done / notDone / actionable
   * ----------------------------------------------------- */
  const anytime = computed(() => bySlot.value[0])

  const done = computed(() =>
    filteredHabits.value.filter(x => x.log && x.log.status === 1)
  )

  const notDone = computed(() =>
    filteredHabits.value.filter(x => !x.log || x.log.status !== 1)
  )

  // 「このタブで今やるべき」＝未完了
  const actionable = computed(() => {
    const slot = activeSlot.value

    // すべてタブ → 全スロットの未完了
    if (slot == null) {
      return notDone.value
    }

    // 個別スロット → そのスロットだけ
    return bySlot.value[slot].filter(
      x => !x.log || x.log.status !== 1
    )
  })

  /* -------------------------------------------------------
   * 次の時間帯（allBySlot を使う → タブに関係なく全体から探す）
   * ----------------------------------------------------- */
  const allBySlot = computed(() => {
    const group = { 0: [], 1: [], 2: [], 3: [], 4: [] }
    for (const x of plannedHabits.value) {
      const s = slotOf(x.h)
      if (s >= 0 && s <= 4) group[s].push(x)
    }
    return group
  })

  const nextSlot = computed(() => {
    const base =
      activeSlot.value ?? serverNowSlot?.value ?? serverNowSlot ?? 0

    for (let s = base + 1; s <= 4; s++) {
      if (allBySlot.value[s]?.length) {
        return {
          slot: s,
          label: ['いつでも', '朝', '昼', '夕', '夜'][s],
        }
      }
    }
    return null
  })

  const nextSlotHabits = computed(() => {
    if (!nextSlot.value) return []
    return allBySlot.value[nextSlot.value.slot] ?? []
  })

  return {
    // タブ＋スロット関連
    activeSlot,
    plannedHabits,
    filteredHabits,
    bySlot,

    // セクション用
    anytime,
    actionable,
    done,
    notDone,

    nextSlot,
    nextSlotHabits,
  }
}