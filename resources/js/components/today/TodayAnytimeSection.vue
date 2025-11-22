<!-- resources/js/components/today/TodayAnytimeSection.vue -->
<template>
  <section v-if="items.length" class="space-y-2">
    <h2 class="text-sm font-semibold text-gray-700">いつでも</h2>

    <div class="rounded-2xl border bg-white divide-y">
      <div
        v-for="x in items"
        :key="'any-' + x.h.id"
        class="px-4 py-3"
      >
        <HabitRow
          :item="x"
          @update="e => onRowUpdate(x.h, e)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  onRowUpdate: { type: Function, required: true },
})
</script>