<!-- resources/js/components/today/HabitRow.vue -->
<template>
  <div
    class="flex items-center justify-between gap-4 py-3"
    :class="isDone ? 'opacity-70' : ''"
  >

    <!-- 左：タイトル＋目標文＋ミニ進捗バー -->
    <div class="min-w-0">
      <div class="font-medium truncate" :class="isDone ? 'line-through' : ''">
        {{ h.title }}
      </div>

      <div class="text-xs text-gray-500 mt-0.5">
        目標: {{ goalText(h) }}
      </div>

      <!-- progress bar -->
      <div class="mt-1 h-2 w-44 rounded-full bg-gray-200 overflow-hidden">
        <div
          v-if="statusKey !== 'snoozed'"
          class="h-full bg-green-500 transition-all"
          :style="{ width: pct + '%' }"
        ></div>
        <div
          v-else
          class="h-full bg-yellow-400 transition-all"
          style="width: 100%"
        ></div>
      </div>
    </div>

    <!-- 右：操作 -->
    <div class="flex items-center gap-3 shrink-0">

      <!-- ★ 自己評価型：Rating UI -->
      <template v-if="h.evaluation_type === 'self'">
        <Rating5
          v-if="log"
          :model-value="log.rating ?? 0"
          @update:modelValue="onRatingChange"
        />

        <!-- status badge -->
        <span
          class="px-2 py-0.5 rounded-full text-xs"
          :class="badgeClass"
        >
          {{ statusLabel }}
        </span>
      </template>

      <!-- ★ 単純評価型：完了トグル -->
      <template v-else>
        <span
          class="px-2 py-0.5 rounded-full text-xs"
          :class="badgeClass"
        >
          {{ statusLabel }}
        </span>

        <button
          class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
          @click="toggleDone"
          :title="isDone ? '未完に戻す' : '完了にする'"
        >
          {{ isDone ? '未完' : '完了' }}
        </button>
      </template>

      <!-- … menu -->
      <div class="relative">
        <button
          class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
          @click="open = !open"
        >
          …
        </button>

        <div
          v-if="open"
          class="absolute right-0 mt-1 w-40 rounded border bg-white shadow z-10"
        >
          <button
            class="block w-full text-left px-3 py-2 hover:bg-gray-50"
            @click="snooze"
          >
            あとで
          </button>

          <button
            class="block w-full text-left px-3 py-2 hover:bg-gray-50"
            @click="skip"
          >
            スキップ
          </button>

          <button
            class="block w-full text-left px-3 py-2 hover:bg-gray-50"
            @click="$emit('detail', h.id)"
          >
            詳細
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Rating5 from '@/components/common/Rating5.vue'
import { progress, uiStatus } from '@/domain/progress'

const props = defineProps({
  habit: { type: Object, required: true },
  log:   { type: Object, default: null },
})

const emit = defineEmits(['update','detail'])

/* v2 selector 互換構造 */
const h   = props.habit
const log = props.log

const open = ref(false)

/* -------------------------------------------------------
 * progress / status
 * ----------------------------------------------------- */
const pct = computed(() => {
  const p = progress(h, log)    // 0〜1
  return Math.round(p * 100)
})

const statusKey = computed(() => uiStatus(h, log))
const isDone    = computed(() => statusKey.value === 'done')

/* -------------------------------------------------------
 * badge 表示（色 + 文言）
 * ----------------------------------------------------- */
const badgeClass = computed(() => {
  switch (statusKey.value) {
    case 'done':
      return 'bg-green-100 text-green-700'
    case 'snoozed':
      return 'bg-yellow-100 text-yellow-700'
    case 'skipped':
      return 'bg-gray-200 text-gray-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
})

const statusLabel = computed(() => {
  return {
    done: '完了',
    snoozed: 'あとで',
    skipped: 'スキップ',
    none: '未完了'
  }[statusKey.value] ?? '未完了'
})

/* -------------------------------------------------------
 * goal 表示
 * ----------------------------------------------------- */
function goalText(h) {
  return h.evaluation_type === 'self'
    ? '自己評価（0〜4）'
    : '1回'
}

/* -------------------------------------------------------
 * Actions（全て emit('update', { status, rating }) で統一）
 * ----------------------------------------------------- */
function toggleDone() {
  emit('update', {
    id: h.id,
    status: isDone.value ? 'none' : 'done',
  })
}

function onRatingChange(val) {
  emit('update', {
    id: h.id,
    rating: val,
  })
}

function snooze() {
  emit('update', {
    id: h.id,
    status: 'snoozed',
  })
  open.value = false
}

function skip() {
  emit('update', {
    id: h.id,
    status: 'skipped',
  })
  open.value = false
}
</script>