<!-- resources/js/components/today/TodayProgress.vue -->
<script setup>
import { computed } from 'vue'

/**
 * progress:
 *   { total, completed, rate }
 *   - anytime の分は親（TodayTab）で除外済み
 */
const props = defineProps({
  progress: {
    type: Object,
    default: () => ({ total: 0, completed: 0, rate: 0 }),
  },
})

/* -------------------------------------------------------
 * Number helpers
 * ----------------------------------------------------- */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/* -------------------------------------------------------
 * Normalized values
 * ----------------------------------------------------- */
const totalCount = computed(() => toNum(props.progress.total))
const doneCount  = computed(() => toNum(props.progress.completed))

/* -------------------------------------------------------
 * % calculation
 * ----------------------------------------------------- */
const pct = computed(() => {
  // rate が来ていたら優先（0〜1）
  if (typeof props.progress.rate === 'number' && props.progress.rate >= 0) {
    return Math.round(props.progress.rate * 100)
  }

  if (!totalCount.value) return 0
  return Math.round((doneCount.value / totalCount.value) * 100)
})
</script>

<template>
  <div class="p-4 rounded-lg border bg-white mb-4">
    <div class="text-lg font-semibold">
      達成率 {{ doneCount }}/{{ totalCount }} ({{ pct }}%)
    </div>

    <div class="mt-2 h-3 rounded-full bg-gray-200 overflow-hidden">
      <div
        class="h-full bg-green-500 transition-all"
        :style="{ width: pct + '%' }"
      ></div>
    </div>
  </div>
</template>