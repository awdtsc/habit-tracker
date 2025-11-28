<!-- resources/js/components/today/TodayNextSlotSection.vue -->
<template>
  <section v-if="items.length" class="space-y-2">
    <h2 class="text-sm font-semibold text-gray-700">
      次の時間帯（{{ nextSlotLabel }}）
    </h2>

    <!-- List -->
    <div class="rounded-2xl border bg-white divide-y">
      <div
        v-for="x in items"
        :key="'next-' + x.h.id"
        class="px-4 py-3"
      >
        <HabitRow
          :habit="x.h"
          :log="x.log"
          :onRowUpdate="e => onRowUpdate(x.h, e)"
        />
      </div>
    </div>

  </section>
</template>

<script setup>
import { computed } from 'vue'
import HabitRow from '@/components/today/HabitRow.vue'
import { slotLabelFor } from '@/domain/timeutil'

const props = defineProps({
  nextSlot: {
    type: Number,
    default: null,
  },
  items: {
    type: Array,
    default: () => [],
  },
  onRowUpdate: {
    type: Function,
    required: true,
  },
})

const nextSlotLabel = computed(() => slotLabelFor(props.nextSlot) ?? '未定')
</script>