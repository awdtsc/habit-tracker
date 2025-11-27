<!-- resources/js/components/today/TodayHeader.vue -->
<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="btn in SLOT_BTNS"
        :key="btn.key"
        class="px-3 py-1 rounded-full border text-sm"
        :class="buttonClass(btn.key)"
        @click="onSelect(btn.key)"
      >
        {{ btn.label }}
      </button>
      <span class="ml-2 text-sm text-gray-500">（現在: {{ currentSlotLabel }}）</span>
    </div>

    <div class="flex items-center gap-4">
      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="showAnytime"
        />
        いつでもを表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="showCompleted"
        />
        完了を表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="h-4 w-4"
          v-model="limitOne"
        />
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
import { slotLabelFor, toSlotNum } from '@/domain/timeutil'

const { state, setFilter } = useUiState()

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
  if (core?.autoMode?.value) return 'auto'
  return core?.selectedSlot?.value ?? 'all'
})

function buttonClass(key) {
  const selected = activeKey.value === key
  const now = toSlotNum(core?.nowSlot?.value)
  const isCurrentSlot = typeof key === 'number' && now === toSlotNum(key)

  if (selected) return 'bg-blue-600 text-white border-blue-600'
  if (isCurrentSlot) return 'bg-blue-100 text-blue-800 border-blue-300'
  return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
}

/* --------------------------------------------------
 * 現在スロット表示（core.nowSlot）
 * -------------------------------------------------- */
const currentSlotLabel = computed(() => {
  const raw = core?.nowSlot?.value
  if (raw == null) return '—'
  return slotLabelFor(raw) ?? '—'
})

/* --------------------------------------------------
 * タブ変更処理（v3 正式対応）
 * -------------------------------------------------- */
function onSelect(key) {
  if (!core) return

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

/* --------------------------------------------------
 * Filters
 * -------------------------------------------------- */
const showAnytime = computed({
  get: () => state.filter.showAnytime,
  set: v => setFilter({ showAnytime: !!v }),
})

const showCompleted = computed({
  get: () => state.filter.showCompleted,
  set: v => setFilter({ showCompleted: !!v }),
})

const limitOne = computed({
  get: () => state.filter.limit === 1,
  set: v => setFilter({ limit: v ? 1 : null }),
})
</script>

<style scoped>
button {
  transition: all 0.15s;
}
</style>
