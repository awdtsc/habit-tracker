<!-- resources/js/components/HabitWeeklyBoard.vue -->
<script setup>
import { onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import ChartWeekly from '@/components/ChartWeekly.vue'

/* ---------------------------------------
 * Store
 * ------------------------------------- */
const auth = useAuthStore()
const weekly = useWeeklyBoard()

if (typeof window !== 'undefined') window.__weekly = weekly

/* ---------------------------------------
 * 曜日ラベル
 * ------------------------------------- */
const DOW_JP = ['月', '火', '水', '木', '金', '土', '日']

/* ---------------------------------------
 * 週の7日
 * ------------------------------------- */
const days = computed(() => weekly.state.days ?? [])

/* ---------------------------------------
 * 日付ごとの「予定されている習慣」リスト
 * ------------------------------------- */
const habitsByDate = computed(() => {
  const map = {}

  for (const d of days.value) {
    const iso = d.iso
    map[iso] = (weekly.state.habits ?? []).filter(h =>
      weekly.isPlanned(h.id, iso)
    )
  }

  return map
})

/* ---------------------------------------
 * 週移動
 * ------------------------------------- */
function shiftWeek(n) {
  const base = weekly.state.week_start
  if (!base) return

  const date = new Date(base)
  date.setDate(date.getDate() + n * 7)

  const iso = date.toISOString().slice(0, 10)
  weekly.fetchWeeklyBoard(iso)
}

/* ---------------------------------------
 * カード色（slot-aware）
 * ------------------------------------- */
function cardClass(h, dateISO) {
  const slot = Number(h.time_slot)
  const st = weekly.getStatus(h.id, dateISO, slot)

  if (st === 'done') return 'bg-green-500 text-white'
  if (st === 'pending') return 'bg-orange-400 text-white'
  return 'bg-gray-200 text-gray-500'
}

/* ---------------------------------------
 * 押せるかどうか
 * ------------------------------------- */
function isDisabled(h, dateISO) {
  const today = new Date().toISOString().slice(0, 10)

  if (dateISO > today) return true
  if (h.start_date && dateISO < h.start_date) return true
  if (h.end_date && dateISO > h.end_date) return true
  if (!weekly.isPlanned(h.id, dateISO)) return true

  return false
}

/* ---------------------------------------
 * トグル（slot-aware）
 * ------------------------------------- */
async function onToggle(habit, dateISO) {
  const slot = Number(habit.time_slot)

  try {
    // 1) トグル（楽観更新）
    await weekly.toggle(habit.id, dateISO, slot)

    // 2) 最新週データを再取得（rates / logs 更新）
    await weekly.fetchWeeklyBoard(weekly.state.week_start)
  } catch (e) {
    console.error('[WeeklyBoard] toggle failed', e)
  }
}

/* ---------------------------------------
 * 初回ロード
 * ------------------------------------- */
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

    <!-- PC版: 7列 -->
    <div class="hidden md:grid grid-cols-7 gap-0 rounded-2xl bg-white shadow ring-1 ring-gray-200">
      <div
        v-for="(d, idx) in days"
        :key="d.iso"
        class="p-4 border-r last:border-r-0 border-gray-200"
      >
        <!-- 日付 -->
        <div class="mb-4 text-center">
          <div class="text-sm text-gray-500">{{ d.label }}</div>
          <div class="text-xs text-gray-400">{{ DOW_JP[idx] }}</div>
        </div>

        <!-- 習慣カード -->
        <div class="space-y-2">
          <button
            v-for="h in habitsByDate[d.iso] ?? []"
            :key="h.id"
            type="button"
            class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium shadow-sm transition active:scale-[0.97]"
            :class="[
              cardClass(h, d.iso),
              isDisabled(h, d.iso) ? 'opacity-40 pointer-events-none' : ''
            ]"
            @click="onToggle(h, d.iso)"
          >
            <div class="flex items-center justify-between">
              <span>{{ h.title }}</span>
              <span
                v-if="weekly.getStatus(h.id, d.iso, Number(h.time_slot)) === 'done'"
                class="ml-2 text-xs"
              >
                ✅
              </span>
            </div>
          </button>

          <div
            v-if="(habitsByDate[d.iso] ?? []).length === 0"
            class="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400"
          >
            予定された習慣はありません
          </div>
        </div>
      </div>
    </div>

    <!-- スマホ版 -->
    <div class="md:hidden rounded-2xl bg-white shadow ring-1 ring-gray-200 overflow-x-auto">
      <div class="flex min-w-max divide-x divide-gray-200">
        <div
          v-for="(d, idx) in days"
          :key="d.iso"
          class="min-w-[200px] p-4"
        >
          <div class="mb-4 text-center">
            <div class="text-sm text-gray-500">{{ d.label }}</div>
            <div class="text-xs text-gray-400">{{ DOW_JP[idx] }}</div>
          </div>

          <div class="space-y-2">
            <button
              v-for="h in habitsByDate[d.iso] ?? []"
              :key="h.id"
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left text-sm font-medium shadow-sm transition active:scale-[0.97]"
              :class="[
                cardClass(h, d.iso),
                isDisabled(h, d.iso) ? 'opacity-40 pointer-events-none' : ''
              ]"
              @click="onToggle(h, d.iso)"
            >
              <div class="flex items-center justify-between">
                <span>{{ h.title }}</span>
                <span
                  v-if="weekly.getStatus(h.id, d.iso, Number(h.time_slot)) === 'done'"
                  class="ml-2 text-xs"
                >
                  ✅
                </span>
              </div>
            </button>

            <div
              v-if="(habitsByDate[d.iso] ?? []).length === 0"
              class="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400"
            >
              予定された習慣はありません
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="mx-auto w-full">
      <ChartWeekly
        :labels="days.map(d => d.label)"
        :values="weekly.state.rates ?? []"
      />
    </div>
  </section>
</template>

<style scoped>
button:active {
  transform: scale(0.97);
}
</style>