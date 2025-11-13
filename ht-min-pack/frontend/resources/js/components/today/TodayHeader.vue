<!-- resources/js/components/today/TodayHeader.vue -->
<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-wrap items-center gap-2">
      <button
  v-for="t in timeslots"
  :key="t.value"
  class="px-3 py-1 rounded-full border text-sm"
  :class="[
    state.filter.timeslot === t.value
      ? 'bg-blue-600 text-white border-blue-600'  // ← 選択中
      : state.resolvedTimeslot === t.value
        ? 'bg-blue-100 text-blue-800 border-blue-300' // ← 現在の時間帯
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
  ]"
  @click="selectTimeslot(t.value)"
>
  {{ t.label }}
</button>
      <span class="ml-2 text-sm text-gray-500">（現在: {{ resolvedLabel }}）</span>
    </div>

    <div class="flex items-center gap-4">
      <!-- ★ 追加：「いつでもを表示」 -->
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="showAnytime"
          @change="onToggleShowAnytime"
        />
        いつでもを表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="showCompleted"
          @change="onToggleShowCompleted"
        />
        完了を表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="limitOne"
          @change="onToggleLimitOne"
        />
        今日一個だけ表示
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useUiState } from '@/stores/uiState'
const { state, setFilter } = useUiState()

const timeslots = [
  { value: 'auto',    label: '自動' },
  { value: 'morning', label: '朝' },
  { value: 'noon',    label: '昼' },
  { value: 'evening', label: '夕' },
  { value: 'night',   label: '夜' },
  { value: 'all',     label: 'すべて' },
]

const showAnytime  = ref(state.filter.showAnytime ?? true)
const showCompleted = ref(state.filter.showCompleted)
const limitOne      = ref(state.filter.limit === 1)

function isActive(v) { return state.filter.timeslot === v }
function selectTimeslot(v) { setFilter({ timeslot: v }) }

function onToggleShowAnytime()  { setFilter({ showAnytime: showAnytime.value }) }
function onToggleShowCompleted(){ setFilter({ showCompleted: showCompleted.value }) }
function onToggleLimitOne()     { setFilter({ limit: limitOne.value ? 1 : null }) }

const resolvedLabel = computed(() => {
  const map = { morning: '朝', noon: '昼', evening: '夕', night: '夜', all: 'すべて' }
  return map[state.resolvedTimeslot] ?? '—'
})

watch(() => state.filter.showAnytime,  v => { showAnytime.value  = v })
watch(() => state.filter.showCompleted, v => { showCompleted.value = v })
watch(() => state.filter.limit,         v => { limitOne.value      = v === 1 })
</script>