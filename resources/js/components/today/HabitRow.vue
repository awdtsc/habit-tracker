<!-- resources/js/components/today/HabitRow.vue -->
<template>
  <div
    class="flex items-center justify-between gap-4 py-3"
    :class="isDone ? 'opacity-70' : ''"
  >
    <!-- 左側：タイトル＋目標文＋進捗バー -->
    <div class="min-w-0">
      <div class="font-medium truncate" :class="isDone ? 'line-through' : ''">
        {{ habit.name || habit.title }}
      </div>

      <div class="text-xs text-gray-500 mt-0.5">
        {{ goalText }}
      </div>

      <!-- 進捗バー -->
      <div class="mt-1 h-2 w-40 rounded-full bg-gray-200 overflow-hidden">
        <div
          class="h-full transition-all"
          :class="isDone ? 'bg-green-400' : 'bg-blue-400'"
          :style="{ width: pct + '%' }"
        ></div>
      </div>
    </div>

    <!-- 右側：操作ボタン -->
    <div class="flex items-center gap-2 shrink-0">

      <!-- 自己評価型 -->
      <template v-if="habit.evaluation_type === 'self'">
        <Rating5
          :model-value="log?.rating ?? 0"
          @update:modelValue="val => emitUpdate({ rating: val })"
        />

        <span class="px-2 py-0.5 rounded-full text-xs" :class="badgeClass">
          {{ statusLabel }}
        </span>
      </template>

      <!-- 通常（done/none）型 -->
      <template v-else>
        <span class="px-2 py-0.5 rounded-full text-xs" :class="badgeClass">
          {{ statusLabel }}
        </span>

        <button
          class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
          @click="emitUpdate({ status: isDone ? 'none' : 'done' })"
        >
          {{ isDone ? '未完' : '完了' }}
        </button>
      </template>

      <!-- 詳細ページ -->
      <button
        class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
        @click="goDetail?.(habit.id)"
        title="詳細"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Rating5 from '@/components/common/Rating5.vue'
import { progress, uiStatus } from '@/domain/progress'

/* ----------------------------------------------------------
 * Props（v2 設計準拠）
 * -------------------------------------------------------- */
const props = defineProps({
  habit: { type: Object, required: true },
  log:   { type: Object, required: false },

  // ★ Section から必ず供給される（todayState を更新する唯一の I/O）
  onRowUpdate: { type: Function, required: true },

  goDetail: { type: Function, required: false },
})

/* ----------------------------------------------------------
 * 参照を揃える（安定性向上）
 * -------------------------------------------------------- */
const habit = computed(() => props.habit)
const log   = computed(() => props.log)

/* ----------------------------------------------------------
 * 親（Section）へ更新イベント
 * -------------------------------------------------------- */
function emitUpdate(payload) {
  props.onRowUpdate(habit.value, payload)
}

/* ----------------------------------------------------------
 * UI 状態計算
 * -------------------------------------------------------- */
const statusKey = computed(() => uiStatus(habit.value, log.value))

const isDone = computed(() => statusKey.value === 'done')

const pct = computed(() =>
  Math.round(progress(habit.value, log.value) * 100)
)

const statusLabel = computed(() => ({
  done: '完了',
  none: '未完',
  snoozed: 'あとで',
  skipped: 'スキップ',
})[statusKey.value] ?? '未完')

const badgeClass = computed(() => ({
  done: 'bg-green-100 text-green-700',
  none: 'bg-blue-100 text-blue-700',
  snoozed: 'bg-yellow-100 text-yellow-700',
  skipped: 'bg-gray-200 text-gray-700',
})[statusKey.value] ?? 'bg-blue-100 text-blue-700')

const goalText = computed(() =>
  habit.value.evaluation_type === 'self'
    ? '自己評価（0〜4）'
    : '1回'
)
</script>
