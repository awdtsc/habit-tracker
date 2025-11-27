<!-- resources/js/components/today/TodayDoneSection.vue -->
<template>
  <section v-if="showCompleted" class="space-y-2">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-700">完了</h2>

      <button
        class="text-sm underline"
        @click="$emit('toggle-collapse-done')"
      >
        {{ collapsed ? '完了を表示' : '完了を隠す' }}
      </button>
    </div>

    <!-- List -->
    <div
      v-show="!collapsed"
      class="rounded-2xl border bg-white divide-y"
    >
      <!-- 0 件 -->
      <div
        v-if="!items.length"
        class="p-4 text-gray-500"
      >
        完了した項目はありません。
      </div>

      <!-- 1 件以上 -->
      <div
        v-for="x in items"
        :key="'done-' + x.h.id"
        class="px-4 py-3 bg-gray-50/60"
      >
        <HabitRow
          :habit="x.h"
          :log="x.log"
          :on-row-update="(habit, payload) => onRowUpdate(habit, payload)"
        />
      </div>
    </div>

  </section>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

const props = defineProps({
  showCompleted: { type: Boolean, default: true },
  collapsed: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  onRowUpdate: { type: Function, required: true },
})

defineEmits(['toggle-collapse-done'])
</script>
