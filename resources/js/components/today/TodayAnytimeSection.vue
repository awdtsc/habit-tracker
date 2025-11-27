<!-- resources/js/components/today/TodayAnytimeSection.vue -->
<template>
  <section v-if="items.length" class="space-y-2">

    <!-- 見出し -->
    <h2 class="text-sm font-semibold text-gray-700">いつでも</h2>

    <!-- カード群 -->
    <div class="rounded-2xl border bg-white divide-y">
      <div
        v-for="x in items"
        :key="'any-' + x.h.id"
        class="px-4 py-3"
      >
        <HabitRow
          :habit="x.h"
          :log="x.log"
          :onUpdate="onRowUpdate"
        />
      </div>
    </div>

  </section>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

const props = defineProps({
  /** items = [{ h, log }] */
  items: { type: Array, default: () => [] },

  /** 完了/未完などの更新時コールバック */
  onRowUpdate: { type: Function, required: true },
})
</script>