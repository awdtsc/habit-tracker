<script setup>
import { computed } from 'vue'
import { useMiniBoard, toggle } from '../composables/useMiniBoard'

const { state, progress, completedCount, totalCount } = useMiniBoard()

const labelOf      = (it) => (it.done ? 'ON' : 'OFF')
const isSaving     = (id) => !!state.saving[id]
const errMsg       = (id) => state.errors[id] || ''
const progressText = computed(() =>
  `${completedCount.value}/${totalCount.value} (${progress.value}%)`
)
</script>

<template>
  <section>
    <header class="mb-2">
      <h2 class="font-semibold">今日の習慣</h2>
      <p class="text-sm text-gray-600">進捗: {{ progressText }}</p>
    </header>

    <ul class="space-y-2">
      <li v-for="it in state.items" :key="it.id" class="flex items-center gap-3">
        <button :disabled="isSaving(it.id)" @click="toggle(it.id)" class="px-3 py-1 border rounded">
          <span v-if="isSaving(it.id)">Saving...</span>
          <span v-else>{{ labelOf(it) }}</span>
        </button>
        <span :class="it.done ? 'line-through text-gray-500' : ''">{{ it.title }}</span>
        <span v-if="errMsg(it.id)" class="text-red-600 text-sm">（{{ errMsg(it.id) }}）</span>
      </li>
    </ul>
  </section>
</template>