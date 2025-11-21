<!-- resources/js/components/today/TodayProgress.vue -->
<script setup>
import { computed } from 'vue'

/**
 * { total, completed } だけを受け取る。
 * anytime は親側（TodayTab）で除外済みという前提。
 */
const props = defineProps({
  progress: {
    type: Object,
    default: () => ({ total: 0, completed: 0 }),
  },
})

const totalCount = computed(() => {
  const v = props.progress
  const n = Number(v?.total ?? 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
})

const doneCount = computed(() => {
  const v = props.progress
  const n = Number(v?.completed ?? 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
})

const pct = computed(() => {
  if (!totalCount.value) return 0
  const raw = (doneCount.value / totalCount.value) * 100
  return Math.round(raw)
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