<script setup>
import axios from 'axios'
import ChartWeekly from './ChartWeekly.vue'
import { ref, computed, onMounted, watch } from 'vue'

function startOfWeek(date = new Date()) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const w = base.getDay() || 7
  if (w !== 1) base.setDate(base.getDate() - (w - 1))
  return base
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function isoLocal(d) { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function mmdd(d) { return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }

const todayISO = isoLocal(new Date())
const DOW_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const start  = ref(startOfWeek())
const days   = computed(() => Array.from({ length: 7 }, (_, i) => {
  const dt = addDays(start.value, i)
  return { iso: isoLocal(dt), mmdd: mmdd(dt), dowEn: DOW_EN[i] }
}))
const rangeLabel = computed(() => `${mmdd(start.value)} 〜 ${mmdd(addDays(start.value, 6))}`)

const habits = ref([])
const checks = ref({})            // { 'habitId|yyyy-mm-dd': true/false }
const rates  = ref(new Array(7).fill(0))
const saving = ref(false)

const API_GET = '/api/weekly-board'
const API_TOGGLE = '/api/habit-logs/toggle'

const key = (hid, dateISO) => `${hid}|${dateISO}`
const isChecked = (hid, dateISO) => !!checks.value[key(hid, dateISO)]
const shiftWeek = n => (start.value = addDays(start.value, n * 7))

// 開始日前・終了日後・未来日は押せない（見た目はデフォでグレー）
const isDisabled = (habit, dateISO) => {
  if (saving.value) return true
  if (dateISO > todayISO) return true
  if (habit?.start_date && dateISO < habit.start_date) return true
  if (habit?.end_date   && dateISO > habit.end_date)   return true
  return false
}

async function fetchBoard() {
  const s = isoLocal(start.value)
  const { data } = await axios.get(API_GET, { params: { start: s } })

  habits.value = data.habits ?? []
  const map = {}
  ;(data.checks ?? []).forEach(r => { map[key(r.habit_id, r.date)] = !!r.value })
  checks.value = map
  rates.value = (data.rates?.length === 7) ? data.rates : new Array(7).fill(0)
}

async function onToggle(habitId, dateISO, val) {
  try {
    saving.value = true
    // 楽観更新
    checks.value = { ...checks.value, [key(habitId, dateISO)]: !!val }
    await axios.post(API_TOGGLE, { habit_id: habitId, date: dateISO, value: !!val })
    await fetchBoard()
  } catch (e) {
    const k = key(habitId, dateISO)
    checks.value = { ...checks.value, [k]: !val }
  } finally {
    saving.value = false
  }
}

onMounted(fetchBoard)
watch(start, fetchBoard)
</script>

<template>
  <section class="mx-auto max-w-6xl p-6 space-y-6">
    <div class="flex items-center justify-between">
      <button class="text-blue-600 hover:underline" @click="shiftWeek(-1)">← 前の週</button>
      <div class="text-2xl font-semibold select-none tracking-wide">{{ rangeLabel }}</div>
      <button class="text-blue-600 hover:underline" @click="shiftWeek(1)">次の週 →</button>
    </div>

    <div class="rounded-2xl bg-white shadow ring-1 ring-gray-200 overflow-x-auto">
      <table class="w-full table-fixed">
        <colgroup>
          <col class="w-44" />
          <col v-for="i in 7" :key="i" class="w-28" />
        </colgroup>

        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="px-5 py-4 text-left text-sm font-semibold text-gray-700">習慣</th>
            <th v-for="d in days" :key="d.iso" class="px-5 py-3 text-center text-sm font-semibold text-gray-700">
              <div class="text-[15px]">{{ d.mmdd }}</div>
              <div class="text-xs text-gray-500">{{ d.dowEn }}</div>
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          <tr v-for="h in habits" :key="h.id">
            <td class="px-5 py-4 text-sm font-medium text-gray-900">{{ h.title }}</td>

            <td v-for="d in days" :key="d.iso" class="p-0">
              <div class="px-3 py-2 flex h-12 w-full items-center justify-center">
                <input
                  type="checkbox"
                  style="appearance:auto;-webkit-appearance:checkbox;-moz-appearance:checkbox"
                  class="form-checkbox h-4 w-4 text-indigo-600 rounded focus:ring-0 focus:outline-none"
                  :checked="isChecked(h.id, d.iso)"
                  :disabled="isDisabled(h, d.iso)"
                  @change="onToggle(h.id, d.iso, $event.target.checked)"
                />
              </div>
            </td>
          </tr>

          <tr v-if="habits.length === 0">
            <td colspan="8" class="px-5 py-10 text-center text-gray-500">
              📌 まだ習慣がありません。右上の「＋ 新しい習慣を追加」から始めてみましょう。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mx-auto w-full">
      <ChartWeekly :labels="days.map(d => d.mmdd)" :values="rates" />
    </div>
  </section>
</template>