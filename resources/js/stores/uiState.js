// resources/js/stores/uiState.js
import { reactive } from 'vue'

/**
 * 「今日の一件だけ表示」は filter.limit === 1 を正とする。
 * 使い勝手のため UI からは filter.onlyOneToday でも操作できるようにして同期する。
 */

const state = reactive({
  mode: 'standard', // 'standard' | 'support' | 'lite'
  filter: {
    timeslot: 'auto',     // 'auto' | 'morning'|'noon'|'evening'|'night'|'all'
    showCompleted: true,  // 既定：完了も表示（下段）
    showAnytime: true,    // いつでも（flex）セクションの表示/非表示
    limit: null,          // 1 で「今日一個だけ」表示（各タブのロジックで解釈）
    onlyOneToday: false,  // UI用フラグ（limit と双方向同期）
  },
  // ★「今」の時間帯を保持（手動選択とは独立）
  resolvedTimeslot: 'morning',
  lockAuto: false,             // 操作中の自動切替抑止
  collapse: { done: false },   // 完了セクション折りたたみ
})

/* =========================
 * 時間帯の解決 & オート更新
 * ======================= */
function resolveTimeslot(now = new Date()) {
  const h = now.getHours() // 0..23
  // 夜: 20:00〜翌4:59
  if (h >= 20 || h < 5) return 'night'
  // 朝: 5:00〜9:59
  if (h < 10) return 'morning'
  // 昼: 10:00〜14:59
  if (h < 15) return 'noon'
  // 夕: 15:00〜19:59
  return 'evening'
}

// ★常に現在時刻で更新（timeslot が auto かどうかに関係なく動かす）
function tickAutoTimeslot(now = new Date()) {
  if (state.lockAuto) return
  state.resolvedTimeslot = resolveTimeslot(now)
}

/* =========================
 * 共通 setters
 * ======================= */
function setMode(m) {
  state.mode = m
  persist()
}

/**
 * filter の部分更新。onlyOneToday と limit はここで相互同期する。
 */
function setFilter(patch) {
  // 先に適用
  Object.assign(state.filter, patch)

  // 相互同期（入力優先順位: patch.onlyOneToday > patch.limit）
  if (Object.prototype.hasOwnProperty.call(patch, 'onlyOneToday')) {
    state.filter.limit = state.filter.onlyOneToday ? 1 : null
  } else if (Object.prototype.hasOwnProperty.call(patch, 'limit')) {
    state.filter.onlyOneToday = state.filter.limit === 1
  } else {
    // どちらも明示されない場合は現状を整合
    state.filter.onlyOneToday = state.filter.limit === 1
  }

  persist()
}

/**
 * 「今日の一件だけ表示」のトグルを直接扱うためのユーティリティ
 */
function toggleOnlyOneToday(on) {
  state.filter.onlyOneToday = !!on
  state.filter.limit = on ? 1 : null
  persist()
}

/**
 * 現在の「一件だけ表示」状態を知る簡易ゲッター
 */
function isOnlyOneToday() {
  return state.filter.limit === 1 // これを正とする
}

/* =========================
 * 永続化
 * ======================= */
function persist() {
  localStorage.setItem('uiState', JSON.stringify({
    mode: state.mode,
    filter: state.filter,
    collapse: state.collapse,
  }))
}

function restore() {
  try {
    const raw = localStorage.getItem('uiState')
    if (raw) {
      const saved = JSON.parse(raw)
      state.mode = saved.mode ?? state.mode
      Object.assign(state.filter, saved.filter ?? {})
      state.collapse = saved.collapse ?? state.collapse

      // 後方互換：limit から onlyOneToday を復元（limit 優先）
      state.filter.onlyOneToday = state.filter.limit === 1
    }
  } catch {}
  tickAutoTimeslot()
}

let intervalId = null
function startAutoTicker() {
  if (intervalId) return
  intervalId = setInterval(() => tickAutoTimeslot(new Date()), 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tickAutoTimeslot(new Date())
  })
}

restore()
startAutoTicker()

export function useUiState() {
  return {
    state,
    setMode,
    setFilter,
    toggleOnlyOneToday,
    isOnlyOneToday,
    resolveTimeslot,
    tickAutoTimeslot,
  }
}