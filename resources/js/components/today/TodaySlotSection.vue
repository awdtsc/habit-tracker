<template>
  <div class="space-y-2">
    <div
      v-for="item in items"
      :key="item.h.id"
      class="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
      @click="goDetail(item.h.id)"
    >
      <div class="font-medium">{{ item.h.title }}</div>

      <div class="text-sm text-gray-500" v-if="item.log">
        完了: {{ item.log.status === 1 ? 'はい' : 'いいえ' }}
      </div>

      <div class="text-sm text-gray-400" v-else>
        未ログ（未チェック）
      </div>
    </div>
  </div>
</template>

<script setup>
/*
  TodaySlotSection は「その時間帯の一覧を出すだけ」の軽量コンポーネント。

  props:
    items: [{ h, log }]
    onRowUpdate (未使用)
    goDetail: function
*/

const props = defineProps({
  items: { type: Array, default: () => [] },
  onRowUpdate: { type: Function, default: () => {} },
  goDetail: { type: Function, default: () => {} },
})
</script>