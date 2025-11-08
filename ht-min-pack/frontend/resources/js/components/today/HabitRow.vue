<!-- resources/js/components/today/HabitRow.vue -->
<template>
  <div class="flex items-center justify-between gap-4 py-3" :class="isDone ? 'opacity-70' : ''">
    <!-- 左：タイトル＋目標文＋ミニ進捗バー -->
    <div class="min-w-0">
      <div class="font-medium truncate" :class="isDone ? 'line-through' : ''">
        {{ habit.title }}
      </div>
      <div class="text-xs text-gray-500 mt-0.5">
        目標: {{ habit.goal_text ?? goalText(habit) }}
      </div>
      <div class="mt-1 h-2 w-44 rounded-full bg-gray-200 overflow-hidden">
        <div
          v-if="statusKey !== 'snoozed'"
          class="h-full bg-green-500 transition-all"
          :style="{ width: Math.round(pct * 100) + '%' }"
        ></div>
        <div
          v-else
          class="h-full bg-yellow-400 transition-all"
          style="width: 100%"
        ></div>
      </div>
    </div>

    <!-- 右：タイプ別入力 + 状態/操作 -->
    <div class="flex items-center gap-3 shrink-0">

      <!-- ★ 自己評価型（self） → Rating UI -->
      <template v-if="habit.evaluation_type === 'self'">
        <Rating5
          v-if="log"
          :model-value="log.rating ?? 0"
          @update:modelValue="onRatingChange"
        />
        <span
          class="px-2 py-0.5 rounded-full text-xs"
          :class="{
            done:'bg-green-100 text-green-700',
            inprogress:'bg-yellow-100 text-yellow-700',
            none:'bg-blue-100 text-blue-700'
          }[statusKey]"
        >
          {{ {done:'完了', inprogress:'進行中', none:'未完了'}[statusKey] }}
        </span>
      </template>

      <!-- ★ 単純評価型（simple） → 完了ボタン -->
      <template v-else>
        <span
          class="px-2 py-0.5 rounded-full text-xs"
          :class="{
            done:'bg-green-100 text-green-700',
            inprogress:'bg-yellow-100 text-yellow-700',
            none:'bg-blue-100 text-blue-700'
          }[statusKey]"
        >
          {{ {done:'完了', inprogress:'進行中', none:'未完了'}[statusKey] }}
        </span>

        <button
          class="px-2 py-1 text-sm rounded border hover:bg-gray-50"
          @click="toggleDone"
          :title="isDone ? '未完に戻す' : '完了にする'">
          {{ isDone ? '未完' : '完了' }}
        </button>
      </template>

      <!-- 共通: その他のメニュー -->
      <div class="relative">
        <button class="px-2 py-1 text-sm rounded border hover:bg-gray-50" @click="open = !open">…</button>
        <div v-if="open" class="absolute right-0 mt-1 w-40 rounded border bg-white shadow z-10">
          <button class="block w-full text-left px-3 py-2 hover:bg-gray-50" @click="snooze">あとで</button>
          <button class="block w-full text-left px-3 py-2 hover:bg-gray-50" @click="skip">スキップ</button>
          <button class="block w-full text-left px-3 py-2 hover:bg-gray-50" @click="$emit('detail', habit.id)">詳細</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { progress, uiStatus } from '@/domain/progress'
import Rating5 from '@/components/common/Rating5.vue'

const props = defineProps({
  habit: { type: Object, required: true },
  log:   { type: Object, default: null },
})

const emit = defineEmits(['update','detail'])
const open = ref(false)

const pct = computed(() => progress(props.habit, props.log))
const statusKey = computed(() => uiStatus(props.habit, props.log))
const isDone = computed(() => statusKey.value === 'done')

function goalText(h) {
  return h?.evaluation_type === 'self' ? '自己評価（0〜4）' : '1回'
}

/** simple用：完了トグル */
function toggleDone() {
  emit('update', { id: props.habit.id, status: isDone.value ? 'none' : 'done' })
}

/** self用：レーティング変更 */
function onRatingChange(val) {
  emit('update', { id: props.habit.id, rating: val })
}

function snooze() {
  emit('update', { id: props.habit.id, status: 'snoozed' })
  open.value = false
}
function skip() {
  emit('update', { id: props.habit.id, status: 'skipped' })
  open.value = false
}
</script>
