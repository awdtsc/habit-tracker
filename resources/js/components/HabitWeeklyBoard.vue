<!-- resources/js/components/HabitWeeklyBoard.vue -->
<script setup>
import { onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import ChartWeekly from '@/components/ChartWeekly.vue'

const auth = useAuthStore()
const weekly = useWeeklyBoard()

if (typeof window !== 'undefined') {
  window.__weekly = weekly
}

const DOW_JP = ['月', '火', '水', '木', '金', '土', '日']

const days = computed(() => weekly.state.days ?? [])

function shiftWeek(n) {
  const base = weekly.state.week_start
  if (!base) return
  const d = new Date(base)
  d.setDate(d.getDate() + n * 7)
  weekly.fetchWeeklyBoard(d.toISOString().slice(0, 10))
}

function cellClass(hid, dateISO) {
  const st = weekly.getStatus(hid, dateISO)
  if (st === 'done') return 'bg-orange-400'
  if (st === 'pending') return 'bg-yellow-300'
  return 'bg-gray-200 opacity-40'
}

function isDisabled(h, dateISO) {
  const today = new Date().toISOString().slice(0, 10)

  if (dateISO > today) return true
  if (h.start_date && dateISO < h.start_date) return true
  if (h.end_date && dateISO > h.end_date) return true
  if (!weekly.isPlanned(h.id, dateISO)) return true

  return false
}

async function onToggle(hid, dateISO) {
  try {
    await weekly.toggle(hid, dateISO)
  } catch (e) {
    console.error('[WeeklyBoard] toggle failed', e)
  }
}

onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return
  await weekly.fetchWeeklyBoard()
})
</script>

<template>
  <section class="mx-auto max-w-6xl p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <button class="text-blue-600 hover:underline" @click="shiftWeek(-1)">
        ← 前の週
      </button>

      <div class="text-2xl font-semibold select-none tracking-wide">
        {{ weekly.state.range_label }}
      </div>

      <button class="text-blue-600 hover:underline" @click="shiftWeek(1)">
        次の週 →
      </button>
    </div>

    <!-- Board -->
    <div class="rounded-2xl bg-white shadow ring-1 ring-gray-200 overflow-x-auto">
      <table class="w-full table-auto">
        <colgroup>
          <!-- 左列：習慣名（幅を自動にして潰れないようにする） -->
          <col class="w-auto" />
          <!-- 右列：7日分 -->
          <col v-for="i in 7" :key="i" class="w-28" />
        </colgroup>

        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-5 py-4 text-left text-sm font-semibold text-gray-700 whitespace-nowrap">
              習慣
            </th>

            <th
              v-for="(d, i) in days"
              :key="d.iso"
              class="px-5 py-3 text-center text-sm font-semibold text-gray-700"
            >
              <div class="text-[15px]">
                {{ d.label }}
              </div>
              <div class="text-xs text-gray-500">
                {{ DOW_JP[i] }}
              </div>
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          <tr v-for="h in weekly.state.habits" :key="h.id">
            <!-- 習慣名 -->
            <td class="px-5 py-4 text-sm font-medium text-gray-900 whitespace-normal">
              {{ h.title }}
            </td>

            <!-- 各日セル -->
            <td v-for="d in days" :key="d.iso" class="p-0">
              <div
                class="px-3 py-2 flex h-12 w-full items-center justify-center cursor-pointer"
                :class="{ 'opacity-40 pointer-events-none': isDisabled(h, d.iso) }"
                @click="!isDisabled(h, d.iso) && onToggle(h.id, d.iso)"
              >
                <div
                  class="h-2 w-12 rounded-full transition-colors duration-150"
                  :class="cellClass(h.id, d.iso)"
                ></div>
              </div>
            </td>
          </tr>

          <!-- 1件も習慣がないとき -->
          <tr v-if="weekly.state.habits.length === 0">
            <td colspan="8" class="px-5 py-10 text-center text-gray-500">
              📌 まだ習慣がありません。右上の「＋ 新しい習慣を追加」から始めてみましょう。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Chart -->
    <div class="mx-auto w-full">
      <ChartWeekly
        :labels="days.map(d => d.label)"
        :values="weekly.state.rates"
      />
    </div>
  </section>
</template>

<style scoped>
td div:active {
  transform: scale(0.95);
}
</style>