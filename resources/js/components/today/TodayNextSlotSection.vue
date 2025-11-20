<!-- resources/js/components/today/TodayNextSlotSection.vue -->
<template>
  <section v-if="items.length" class="space-y-2">
    <h2 class="text-sm font-semibold text-gray-700">
      次の時間帯（{{ nextSlotText }}）
    </h2>

    <div class="rounded-2xl border bg-white divide-y">
      <div
        v-for="x in items"
        :key="'next-' + x.h.id"
        class="px-4 py-3"
      >
        <HabitRow
          :habit="x.h"
          :log="x.log"
          @update="(e) => onRowUpdate(x.h, e)"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, unref } from 'vue'
import HabitRow from '@/components/today/HabitRow.vue'

/*
  nextSlot は実際は:
    - null
    - 'evening'
    - { slot: 'evening', label: '夕方', ... }   ← これが来てる
*/

const props = defineProps({
  nextSlot: {
    type: [String, Object, null],   // ← ここが正解
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

/* ----------------------------------------------
 * UI 表示用のテキスト整形
 * ---------------------------------------------- */
const nextSlotText = computed(() => {
  const v = unref(props.nextSlot)

  if (!v) return '未定'

  // string の場合（"morning" etc）そのまま
  if (typeof v === 'string') return v

  // object の場合（slot / label のセットなど）
  if (typeof v === 'object' && v.label) return v.label
  if (typeof v === 'object' && v.slot) return v.slot

  return '未定'
})
</script>
