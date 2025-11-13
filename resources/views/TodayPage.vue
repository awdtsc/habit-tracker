<!-- resources/js/views/TodayPage.vue -->
<template>
  <div class="mx-auto max-w-5xl px-4 py-6">
    <h1 class="text-2xl font-semibold mb-4">今日</h1>

    <TodayHeader class="mb-4" />

    <!-- 対象概要 -->
    <div class="text-sm text-gray-600 mb-2">
      対象: {{ resolvedTimeslotLabel }} ／
      完了{{ ui.state.filter.showCompleted ? '含む' : '隠す' }} ／
      {{ ui.state.filter.limit === 1 ? '1件だけ' : '全件' }}
    </div>

    <div class="rounded border bg-white divide-y">
      <!-- 未完（todo/snoozed） -->
      <div v-if="actionable.length === 0" class="p-4 text-gray-500">
        未完の習慣はありません。
      </div>
      <div v-for="x in actionableLimited" :key="x.h.id" class="px-4">
        <HabitRow
          :habit="x.h"
          :log="x.log"
          @update="onUpdate"
          @detail="goDetail"
        />
      </div>

      <!-- 完了（折りたたみ） -->
      <div class="p-3 bg-gray-50">
        <button class="text-sm text-gray-700" @click="toggleCollapseDone">
          完了済み（{{ done.length }}） <span>{{ ui.state.collapse.done ? '▶' : '▼' }}</span>
        </button>
        <div v-show="!ui.state.collapse.done" class="mt-2 rounded border bg-white divide-y">
          <div v-for="x in done" :key="x.h.id" class="px-4">
            <HabitRow :habit="x.h" :log="x.log" @update="onUpdate" @detail="goDetail" />
          </div>
        </div>
      </div>

      <!-- スキップ（任意で非表示にしてOK） -->
      <div v-if="skipped.length" class="p-3 bg-gray-50 border-t">
        <div class="text-sm text-gray-600">スキップ（{{ skipped.length }}）</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TodayHeader from '@/components/today/TodayHeader.vue'
import HabitRow from '@/components/today/HabitRow.vue'
import { useUiState } from '@/stores/uiState'
import { priorityScore } from '@/domain/priority'

// ★↓↓ 実データに差し替え。habit一覧 & 今日のログ取得関数を提供してください。
import { ref } from 'vue'
// 例データ
const habits = ref([
  { id: 1, title: '歯磨き', type: 'boolean', timeslot: 'morning', focus: true },
  { id: 2, title: '日記',   type: 'boolean', timeslot: 'evening', focus: false },
])
const logsMap = ref({
  // '1@2025-08-22': { status: 'todo' },
})
function todayKey(id) {
  const d = new Date(); const y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice( -2 ), day=('0'+d.getDate()).slice(-2)
  return `${id}@${y}-${m}-${day}`
}
function getTodayLog(id) { return logsMap.value[todayKey(id)] ?? { status:'todo' } }
function setTodayLog(id, patch) {
  logsMap.value[todayKey(id)] = { ...(logsMap.value[todayKey(id)] ?? {}), ...patch }
}
// ↑↑ここまでダミー

const ui = useUiState()
const resolvedTimeslot = computed(() =>
  ui.state.filter.timeslot === 'auto' ? ui.state.resolvedTimeslot : ui.state.filter.timeslot
)

const now = computed(() => new Date())

// ステータス別に分割し、actionable はスコアで並べる
const actionable = computed(() => {
  const arr = []
  for (const h of habits.value) {
    if (resolvedTimeslot.value !== 'all' && (h.timeslot ?? 'all') !== resolvedTimeslot.value) continue
    const log = getTodayLog(h.id)
    const st = log?.status ?? 'todo'
    if (st === 'done' || st === 'skipped') continue
    arr.push({ h, log })
  }
  arr.sort((a, b) =>
    priorityScore({ habit: b.h, log: b.log, now: now.value, resolvedTimeslot: resolvedTimeslot.value })
    - priorityScore({ habit: a.h, log: a.log, now: now.value, resolvedTimeslot: resolvedTimeslot.value })
  )
  return arr
})
const actionableLimited = computed(() =>
  ui.state.filter.limit === 1 ? actionable.value.slice(0, 1) : actionable.value
)

const done = computed(() => {
  const res = []
  for (const h of habits.value) {
    if (resolvedTimeslot.value !== 'all' && (h.timeslot ?? 'all') !== resolvedTimeslot.value) continue
    const log = getTodayLog(h.id)
    if (log?.status === 'done') res.push({ h, log })
  }
  return ui.state.filter.showCompleted ? res : []
})
const skipped = computed(() => {
  const res = []
  for (const h of habits.value) {
    if (resolvedTimeslot.value !== 'all' && (h.timeslot ?? 'all') !== resolvedTimeslot.value) continue
    const log = getTodayLog(h.id)
    if (log?.status === 'skipped') res.push({ h, log })
  }
  return res
})

function toggleCollapseDone() {
  ui.state.collapse.done = !ui.state.collapse.done
  // 永続化（UI状態は内部で persist 済みでないため必要なら呼ぶ）
  localStorage.setItem('uiState', JSON.stringify({
    mode: ui.state.mode, filter: ui.state.filter, collapse: ui.state.collapse
  }))
}

function onUpdate({ id, status, snooze_to }) {
  setTodayLog(id, { status, ...(snooze_to ? { snooze_to } : {}) })
}
function goDetail(id) {
  // ここでルーター遷移させる：例）router.push(`/habits/${id}`)
  console.debug('detail:', id)
}

const resolvedTimeslotLabel = computed(() => {
  const map = { morning: '朝', noon: '昼', evening: '夕', night: '夜', all: 'すべて' }
  return map[resolvedTimeslot.value] ?? '—'
})
</script>
