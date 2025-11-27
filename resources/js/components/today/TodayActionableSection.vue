<!-- resources/js/components/today/TodayActionableSection.vue -->
<template>
  <!-- items が 0 件ならカードを出さず、メッセージだけ -->
  <div
    v-if="!items || items.length === 0"
    class="text-gray-500 text-center py-6"
  >
    この時間帯に残っている習慣はありません。
  </div>

  <!-- items が 1 件以上なら HabitRow を描画 -->
  <div v-else class="space-y-3">
    <HabitRow
      v-for="it in items"
      :key="it.h.id"
      :habit="it.h"
      :log="it.log"
      :onRowUpdate="(habit, payload) => onRowUpdate(habit, payload)"
      :goDetail="goDetail"
    />
  </div>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

defineProps({
  items: { type: Array, default: () => [] },
  onRowUpdate: { type: Function, required: true },
  goDetail: { type: Function, default: () => {} },
})
</script>
