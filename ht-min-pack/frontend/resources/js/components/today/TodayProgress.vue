<script setup>
import { computed } from 'vue'
import { normalizeTimeslot } from '@/domain/timeutil'

const props = defineProps({
  habits: { type: Array, required: true },
  getTodayLog: { type: Function, required: true },
  timeslot: { type: String, required: true }
})

// ✅ 対象習慣のフィルタリング
const targetHabits = computed(() => {
  if (props.timeslot === 'all') {
    // すべてタブ → すべて含む（いつでもも含める）
    return props.habits
  } else {
    // 個別タブ → その時間帯だけ（いつでもは除外）
    return props.habits.filter(h => normalizeTimeslot(h.time_slot) === props.timeslot)
  }
})

// ✅ 完了数（前回値が残っていればそのまま使える）
const doneCount = computed(() =>
  targetHabits.value.filter(h => {
    const log = props.getTodayLog(h.id)
    return log && log.status === 'done'
  }).length
)

const totalCount = computed(() => targetHabits.value.length)

// ✅ pct: 未ロード時も「前回値」が返ってくるので、そのまま計算可能
const pct = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((doneCount.value / totalCount.value) * 100)
})
</script>

<template>
  <div class="p-4 rounded border bg-white mb-4">
    <div class="text-lg font-semibold">
      達成率 {{ doneCount }}/{{ totalCount }} ({{ pct }}%)
    </div>
    <div class="mt-2 h-4 rounded-full bg-gray-200 overflow-hidden">
      <div
        class="h-full bg-green-500 transition-all"
        :style="{ width: pct + '%' }"
      ></div>
    </div>
  </div>
</template>