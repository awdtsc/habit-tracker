// resources/js/stores/habitBoard/index.js

/**
 * HabitBoard v2 エントリポイント
 *
 * ここから他のファイルは基本的に
 *   import { useHabitBoard } from '@/stores/habitBoard'
 * のように使う想定。
 *
 * - useHabitBoard … Pinia ストアインスタンスを返す（互換用）
 * - その他: store / api / selectors の関数を再エクスポート
 */

import { useHabitBoardStore } from './store'

// 互換用ラッパ（前の実装が useHabitBoard を使っていた前提）
export function useHabitBoard() {
  return useHabitBoardStore()
}

// ストア本体（型補完などで使いたくなったとき用）
export { useHabitBoardStore } from './store'

// API ラッパ
export * as habitBoardApi from './api'

// セレクタ群（純粋関数）
export * as habitBoardSelectors from './selectors'