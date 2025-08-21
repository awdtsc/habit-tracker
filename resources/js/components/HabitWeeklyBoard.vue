<!-- resources/js/components/HabitWeeklyBoard.vue -->
<script setup>
import { computed, onMounted } from 'vue'
import { useHabitBoard } from '@/stores/useHabitBoard'
import ChartWeekly from '@/components/ChartWeekly.vue'

const { state, fetchBoard, toggle, isFresh } = useHabitBoard()

// 週の開始日は store(state.start) を使用
onMounted(() => {
  if (!isFresh(60_000) || !state.habits.length) fetchBoard({ silent: !!state.habits.length })
})

/* 日付ユーティリティ（表示用） */
function addDays(date, n){ const d = new Date(date); d.setDate(d.getDate()+n); return d }
function iso(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
function mmdd(d){ return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }

const DOW_EN = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const days = computed(() =>
  Array.from({length:7},(_,i)=> {
    const dt = addDays(state.start, i)
    return { iso: iso(dt), mmdd: mmdd(dt), dowEn: DOW_EN[i] }
  })
)

const key = (hid, dateISO) => `${hid}|${dateISO}`
const isChecked = (hid, dateISO) => !!state.checks[key(hid, dateISO)]
const todayISO = iso(new Date())

/* その日が対象か（storeのロジックと整合させる） */
function isScheduledFor(h, dateISO){
  if (h?.start_date && dateISO < h.start_date) return false
  if (h?.end_date   && dateISO > h.end_date)   return false
  const dt = new Date(dateISO)
  const dow = ((dt.getDay()+6)%7)+1
  switch (h?.frequency_type){
    case 'daily': return true
    case 'weekdays': return dow>=1 && dow<=5
    case 'weekends': return dow===6 || dow===7
    case 'custom': return Array.isArray(h?.days_of_week) && h.days_of_week.map(Number).includes(dow)
    case 'quota': return true
    default: return true
  }
}
const isDisabled = (h, dateISO) => {
  if (dateISO > todayISO) return true
  if (!isScheduledFor(h, dateISO)) return true
  return false
}

/* 週移動：state.start を動かしてから再取得 */
function shiftWeek(n){
  const d = new Date(state.start); d.setDate(d.getDate() + n*7)
  state.start = d
  fetchBoard({ silent: true })
}

/* 週表からのトグルも store 経由でOK（楽観更新→ratesも即反映） */
const onToggle = (hid, dateISO, val) => toggle(hid, dateISO, val)
</script>

<template>
  <section class="mx-auto max-w-6xl p-6 space-y-6">
    <div class="flex items-center justify-between">
      <button class="text-blue-600 hover:underline" @click="shiftWeek(-1)">← 前の週</button>
      <div class="text-2xl font-semibold select-none tracking-wide">
        {{ mmdd(state.start) }} 〜 {{ mmdd(new Date(state.start.getFullYear(), state.start.getMonth(), state.start.getDate()+6)) }}
      </div>
      <button class="text-blue-600 hover:underline" @click="shiftWeek(1)">次の週 →</button>
    </div>

    <div class="rounded-2xl bg-white shadow ring-1 ring-gray-200 overflow-x-auto">
      <table class="table-fixed w-full" style="--habit-col: 8.5rem;">
        <colgroup>
          <col style="width: var(--habit-col)" />
          <col v-for="i in 7" :key="i" :style="{ width: 'calc((100% - var(--habit-col)) / 7)'}" />
        </colgroup>

        <thead class="bg-gray-50 border-b">
          <tr class="align-middle">
            <th class="p-0 text-left"><div class="px-4 py-4 text-sm font-semibold text-gray-700">習慣</div></th>
            <th v-for="d in days" :key="d.iso" class="p-0">
              <div class="h-12 w-full pl-4 pr-[14px] flex flex-col items-end justify-center">
                <div class="text-[15px] leading-tight tabular-nums">{{ d.mmdd }}</div>
                <div class="text-xs text-gray-500 leading-tight">{{ d.dowEn }}</div>
              </div>
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">
          <tr v-for="h in state.habits" :key="h.id" class="align-middle">
            <td class="p-0"><div class="px-4 py-4 text-sm font-medium text-gray-900">{{ h.title }}</div></td>
            <td v-for="d in days" :key="d.iso" class="p-0">
              <div class="h-12 w-full pl-4 pr-[14px] flex items-center justify-center"
                   :class="isDisabled(h, d.iso) ? 'opacity-40 pointer-events-none' : ''"
                   :title="isDisabled(h, d.iso) ? 'この日は対象外です' : ''">
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

          <tr v-if="state.habits.length === 0">
            <td colspan="8" class="px-5 py-10 text-center text-gray-500">📌 まだ習慣がありません。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mx-auto w-full">
      <ChartWeekly :labels="days.map(d => d.mmdd)" :values="state.rates" />
    </div>
  </section>
</template>
