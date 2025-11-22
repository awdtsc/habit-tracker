<!-- resources/js/components/today/TodayActionableSection.vue -->
<script setup>
defineProps({
  items: {
    type: Array,
    required: true
  },
  onRowUpdate: {
    type: Function,
    required: true
  },
  goDetail: {
    type: Function,
    required: false
  }
})
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="item in items"
      :key="item.h.id"
      class="p-4 bg-white rounded shadow-sm border cursor-pointer"
      @click="goDetail && goDetail(item.h.id)"
    >
      <div class="flex justify-between items-center">
        <div class="font-medium">{{ item.h.name }}</div>

        <!-- 状態変更ボタン（最低限） -->
        <button
          class="px-3 py-1 rounded bg-blue-500 text-white text-sm"
          @click.stop="onRowUpdate(item.h, { status: item.log?.status === 'done' ? 'none' : 'done' })"
        >
          {{ item.log?.status === 'done' ? '未完了へ' : '完了' }}
        </button>
      </div>
    </div>
  </div>
</template>