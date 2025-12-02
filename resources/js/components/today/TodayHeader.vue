<!-- resources/js/components/today/TodayHeader.vue -->
<template>
  <div class="flex flex-wrap items-center gap-3">

    <!-- 時間帯タブ -->
    <div class="flex gap-2 items-center">
      <button
        v-for="btn in SLOT_BTNS"
        :key="btn.key"
        class="px-3 py-1 rounded-full border text-sm"
        :class="activeClass(btn.key)"
        @click="setTimeslot(btn.key)"
      >
        {{ btn.label }}
      </button>
    </div>

    <!-- 現在スロット -->
    <div class="text-xs text-gray-500">(現在: {{ currentSlotLabel }})</div>

    <!-- フィルター類 -->
    <div class="flex gap-4 items-center ml-auto">

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox"
               v-model="ui.state.filter.showAnytime" />
        いつでも表示
      </label>

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox"
               v-model="ui.state.filter.showCompleted" />
        完了を表示
      </label>

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox"
               v-model="ui.state.filter.onlyOneToday" />
        今日一個だけ表示
      </label>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useUiState } from '@/stores/uiState'
import { useTodayState } from '@/composables/useTodayState'

const ui = useUiState()
const core = useTodayState()

/* --------------------------------------------------
 * 時間帯タブ定義
 * -------------------------------------------------- */
const SLOT_BTNS = [
  { key: 'morning', label: '朝' },
  { key: 'noon',    label: '昼' },
  { key: 'evening', label: '夕' },
  { key: 'night',   label: '夜' },
  { key: 'anytime', label: 'いつでも' },
  { key: 'all',     label: 'すべて' },
]

/* --------------------------------------------------
 * アクティブ状態
 * -------------------------------------------------- */
const activeKey = computed(() => ui.state.filter.timeslot ?? 'all')

function activeClass(key) {
  return activeKey.value === key
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-white text-gray-700'
}

/* --------------------------------------------------
 * 現在スロット（安全版）
 * -------------------------------------------------- */
const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

const currentSlotLabel = computed(() => {
  const slot = core.serverNowSlot?.value
  return SLOT_LABEL[slot] ?? '—'
})

/* --------------------------------------------------
 * クリック時
 * -------------------------------------------------- */
function setTimeslot(key) {
  ui.state.filter.timeslot = key
}
</script>

<style scoped>
button {
  transition: all 0.15s;
}
</style>