<!-- resources/js/components/today/TodayHeader.vue -->
<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

    <!-- スロットタブ -->
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

      <span class="ml-2 text-sm text-gray-500">
        （現在: {{ currentSlotLabel }}）
      </span>
    </div>

    <!-- フィルター群 -->
    <div class="flex items-center gap-4">

      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4" v-model="showAnytime" />
        いつでもを表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4" v-model="showCompleted" />
        完了を表示
      </label>

      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" class="h-4 w-4" v-model="limitOne" />
        今日一個だけ表示
      </label>

    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useUiState } from '@/stores/uiState'
import { slotLabelFor, toSlotNum } from '@/domain/timeutil'

/* --------------------------------------------------
 * props（親：TodayTab.vue から渡される）
 * -------------------------------------------------- */
const props = defineProps({
  changeTab: {
    type: Function,
    required: true,
  },
})

/* -------------------------------------------------- */
const { state, setFilter } = useUiState()

// TodayTab の provide('today', core)
const core = inject('today')
if (!core) {
  console.error('[TodayHeader] <today> not provided')
}

/* --------------------------------------------------
 * タブ定義（UI は文字列キーで扱う）
 * -------------------------------------------------- */
const SLOT_BTNS = [
  { key: 'auto',    label: '自動' },
  { key: 'all',     label: 'すべて' },
  { key: 'morning', label: '朝' },
  { key: 'noon',    label: '昼' },
  { key: 'evening', label: '夕' },
  { key: 'night',   label: '夜' },
]

/* --------------------------------------------------
 * activeTabName
 *  - autoMode: 'auto'
 *  - selectedSlot: 1〜4 を morning/noon/… に変換
 *  - null: 'all'
 * -------------------------------------------------- */
const activeTabName = computed(() => {
  if (core?.autoMode?.value) return 'auto'

  const slot = core?.selectedSlot?.value
  if (slot == null) return 'all'

  const map = {
    1: 'morning',
    2: 'noon',
    3: 'evening',
    4: 'night',
  }

  return map[slot] ?? 'all'
})

/* --------------------------------------------------
 * ボタンスタイル
 * -------------------------------------------------- */
function buttonClass(key) {
  const selected = activeTabName.value === key

  // 現在スロット（1〜4）を取得
  const nowNum = toSlotNum(core?.nowSlot?.value)

  // キー → スロット番号（ハイライト用）
  const slotMap = {
    morning: 1,
    noon: 2,
    evening: 3,
    night: 4,
  }
  const keySlot = slotMap[key] ?? null
  const isCurrentSlot = keySlot != null && keySlot === nowNum

  if (selected) {
    return 'bg-blue-600 text-white border-blue-600'
  }
  if (isCurrentSlot) {
    return 'bg-blue-100 text-blue-800 border-blue-300'
  }
  return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
}

/* --------------------------------------------------
 * 現在のスロットラベル
 * -------------------------------------------------- */
const currentSlotLabel = computed(() => {
  const raw = core?.nowSlot?.value
  return slotLabelFor(raw) ?? '—'
})

/* --------------------------------------------------
 * タブ変更イベント（親に伝える）
 * -------------------------------------------------- */
function onSelect(key) {
  // key は 'auto' | 'all' | 'morning' | 'noon' | 'evening' | 'night'
  props.changeTab(key)
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