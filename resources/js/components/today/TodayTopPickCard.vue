<!-- resources/js/components/today/TodayTopPickCard.vue -->
<template>
  <section class="rounded-2xl border p-4 bg-amber-50">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold text-amber-700">いまのおすすめ</div>
        <div class="text-lg font-semibold">
          {{ topPick.h.title || topPick.h.name }}
        </div>
        <div class="text-xs text-gray-500">
          スロット: {{ timeslotLabel(slotStr(topPick.h.time_slot)) }}
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white"
          @click="onRowUpdate(topPick.h, { status: 'done', value: true })"
        >
          完了にする
        </button>
        <button
          class="px-3 py-1.5 text-sm rounded-md border"
          @click="openRemindModal(topPick.h.id)"
        >
          後で（通知）
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import axios from '@/axios'

const props = defineProps({
  topPick: { type: Object, required: true },
  timeslotLabel: { type: Function, required: true },
  onRowUpdate: { type: Function, required: true },
})

const slotStr = (v) => {
  const n = Number(v || 0)
  if (n === 1) return 'morning'
  if (n === 2) return 'noon'
  if (n === 3) return 'evening'
  if (n === 4) return 'night'
  return 'flex'
}

async function openRemindModal(habitId) {
  try {
    const { data } = await axios.get('/api/remind-tasks/latest-by-habit', {
      params: { habit_id: habitId },
      withCredentials: true,
    })
    const taskId = data?.task?.id
    if (taskId) {
      const ev = new CustomEvent('open-remind-modal', { detail: { taskId } })
      window.__remindBus?.dispatchEvent(ev)
      window.dispatchEvent(ev)
    }
  } catch (e) {
    console.error('[TodayTopPickCard] openRemindModal failed', e?.response?.data || e)
  }
}
</script>