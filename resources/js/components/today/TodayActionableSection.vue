<!-- resources/js/components/today/TodayActionableSection.vue -->
<template>
  <section class="rounded-2xl border bg-white divide-y">
    <div v-if="loading" class="p-4 text-gray-500">読み込み中…</div>

    <template v-else>
      <div v-if="!items.length" class="p-4 text-gray-500">
        いまやる項目はありません。
      </div>

      <div
        v-for="x in items"
        :key="'act-' + x.h.id"
        class="px-4 py-3"
      >
        <!-- HabitRow: v2 API (habit + log) -->
        <HabitRow
          :habit="x.h"
          :log="x.log"
          @update="e => onRowUpdate(x.h, e)"
        />

        <!-- 小さなボタン行 -->
        <div class="flex gap-3 py-2 text-xs text-gray-600">
          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="toggleFocus(x.h.id)"
          >
            {{ isFocused(x.h.id) ? 'フォーカス解除' : 'フォーカス' }}
          </button>

          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="goDetail(x.h.id)"
          >
            詳細
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import HabitRow from '@/components/today/HabitRow.vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  isFocused: { type: Function, required: true },
  toggleFocus: { type: Function, required: true },
  goDetail: { type: Function, required: true },
  onRowUpdate: { type: Function, required: true },
})
</script>