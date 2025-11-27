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
        @click="onSelect(btn.key)"
      >
        {{ btn.label }}
      </button>
    </div>

    <!-- 現在スロット -->
    <div class="text-xs text-gray-500">
      (現在: {{ currentSlotLabel }})
    </div>

    <!-- フィルター -->
    <div class="flex gap-4 items-center ml-auto">

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox" v-model="ui.state.filter.showAnytime" />
        いつでも表示
      </label>

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox" v-model="ui.state.filter.showCompleted" />
        完了を表示
      </label>

      <label class="flex items-center gap-1 text-sm">
        <input type="checkbox" v-model="ui.state.filter.onlyOneToday" />
        今日一個だけ表示
      </label>

    </div>

  </div>
</template>

<script setup>
/* --------------------------------------------------
 * inject('today') で TodayState v3 を受け取る
 * useTodayState() をここで呼んでは絶対にダメ
 * -------------------------------------------------- */
import { computed, inject } from 'vue'
import { useUiState } from '@/stores/uiState'

const ui = useUiState()

// provide('today', core) が必須
const core = inject('today')
if (!core) {
  console.error('[TodayHeader] <today> not provided')
}


/* --------------------------------------------------
 * タブ定義
 * -------------------------------------------------- */
const SLOT_BTNS = [
  { key: 'auto', label: '自動' },
  { key: 'all',  label: 'すべて' },
  { key: 1,      label: '朝' },
  { key: 2,      label: '昼' },
  { key: 3,      label: '夕' },
  { key: 4,      label: '夜' },
]

/* --------------------------------------------------
 * activeKey（現在選択中のタブ）
 * -------------------------------------------------- */
const activeKey = computed(() => {
  if (core.autoMode.value) return 'auto'
  return core.selectedSlot.value ?? 'all'
})

function activeClass(key) {
  return activeKey.value === key
    ? 'bg-blue-600 text-white border-blue-600'
    : 'bg-white text-gray-700'
}


/* --------------------------------------------------
 * 現在スロット表示（core.nowSlot）
 * -------------------------------------------------- */
const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

const currentSlotLabel = computed(() => {
  return SLOT_LABEL[core.nowSlot.value] ?? '—'
})


/* --------------------------------------------------
 * タブ変更処理（v3 正式対応）
 * -------------------------------------------------- */
function onSelect(key) {

  // AUTO モード
  if (key === 'auto') {
    core.enableAuto()
    return
  }

  // 手動モードへ切り替え
  core.disableAuto()

  // "すべて"
  if (key === 'all') {
    core.selectedSlot.value = null
    return
  }

  // 1〜4 のスロット
  core.selectedSlot.value = key
}
</script>

<style scoped>
button {
  transition: all 0.15s;
}
</style>
