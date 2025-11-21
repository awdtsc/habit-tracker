// resources/js/composables/useTodayState.js

import { useUiState } from '@/stores/uiState'
import { useHabitBoard } from '@/stores/useHabitBoard'

import { initUiState, createFocusState } from './useTodayUi'
import { useTodayLoader } from './today/useTodayLoader'
import { useTodayActions } from './today/useTodayActions'
import { useTodayLists } from './today/useTodayLists'

export function useTodayState() {
  const ui    = useUiState()
  const board = useHabitBoard()

  // UI 初期化
  initUiState(ui)

  // ① Loader を先に作る（serverDate が使えるようにする）
  const loader = useTodayLoader(board, {
    isFocused: () => false   // ダミー（Loader は focus を使わない）
  })

  // ② 正しい focus を作る（null は絶対NG）
  const focus = createFocusState(ui, loader.serverDate)

  // ③ Actions（toggle / rating）
  const actions = useTodayActions(
    board,
    loader.habits,
    loader.todayYmd,
    ui,
    loader.apiTopPick
  )

  // ④ TodayLists（items + progressRate）
  const lists = useTodayLists(
    ui,
    loader.habits,
    board,
    loader.todayYmd,
    loader.serverNowSlot
  )

  return {
    ui,
    board,

    // Loader
    ...loader,
    fetchToday: loader.fetchToday,

    // Focus
    ...focus,

    // Actions
    ...actions,

    // Lists (items, progressRate)
    ...lists,
  }
}

export default useTodayState