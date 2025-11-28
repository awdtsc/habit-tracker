<!-- resources/js/components/today/TodayTopPickCard.vue -->
<template>
  <section
    v-if="topPick && topPick.h"
    class="rounded-2xl border p-4 bg-amber-50"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="text-xs font-semibold text-amber-700">
          いまのおすすめ
        </div>

        <!-- 安全ガード付き -->
        <div class="text-lg font-semibold mt-1">
          {{ topPick.h?.title || topPick.h?.name || '' }}
        </div>

        <div class="text-xs text-gray-500 mt-1">
          スロット: {{ slotLabel }}
        </div>
      </div>

      <div class="flex gap-2 self-end sm:self-auto">
        <button
          class="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white"
          @click="onRowUpdate(topPick.h, { status: 'done', value: true })"
        >
          完了にする
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  topPick: { type: Object, required: true },
  timeslotLabel: { type: String, required: true },
  onRowUpdate: { type: Function, required: true },
})

const slotLabel = props.timeslotLabel
</script>