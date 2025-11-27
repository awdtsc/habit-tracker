<!-- resources/js/components/today/TodayActionableSection.vue -->
<template>
  <section class="space-y-3">
    <div
      v-for="x in items"
      :key="x.h.id"
      class="p-4 bg-white rounded-2xl border shadow-sm"
    >
      <HabitRow
        :habit="x.h"
        :log="x.log"
        :onUpdate="onRowUpdate"
        :goDetail="goDetail"
      />
    </div>
  </section>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

const props = defineProps({
  items: { type: Array, required: true },
  onRowUpdate: { type: Function, required: true },
  goDetail: { type: Function, required: false },
})
</script>