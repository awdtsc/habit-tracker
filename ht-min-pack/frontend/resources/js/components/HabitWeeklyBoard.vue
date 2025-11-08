<!-- resources/js/components/HabitWeeklyBoard.vue -->
<template>
  <section class="mx-auto max-w-6xl p-6 space-y-6">
    <!-- ヘッダー -->
    <div class="flex items-center justify-between">
      <button class="text-blue-600 hover:underline" @click="shiftWeek(-1)">← 前の週</button>
      <div class="text-2xl font-semibold select-none tracking-wide">
        {{ formatRange(state.start) }}
      </div>
      <button class="text-blue-600 hover:underline" @click="shiftWeek(1)">次の週 →</button>
    </div>

    <!-- ===== モバイル：横スクロール＋スナップ＋ +N ===== -->
    <div class="md:hidden relative">
      <div class="week-scroll overflow-x-auto snap-x snap-mandatory scroll-pl-4 pr-4 -mx-4 px-4">
        <div class="flex gap-3 min-w-max">
          <!-- 各日カラム -->
          <div
            v-for="d in days"
            :key="d.iso"
            class="snap-start shrink-0 w-[44vw] sm:w-[36vw]">

            <!-- 日付ヘッダ -->
            <div class="text-center text-[11px] text-gray-500 mb-1">
              <span class="font-medium text-gray-700">{{ d.mmdd }}</span>
              <span class="ml-1 text-gray-500">{{ d.dowJa }}</span>
            </div>

            <!-- 本体カード（中身がある日だけ描画） -->
            <div v-if="habitsForDay(d.iso).length" class="space-y-1">
              <!-- 行：ボックス全体で色を判断（完了=緑 / 未=オレンジ） -->
              <button
                v-for="(h, i) in habitsForDay(d.iso).slice(0, 3)"
                :key="h.id + '-' + h.time_slot + '-' + i"
                @click="onToggle(h, d.iso)"
                class="w-full flex items-center gap-2 rounded-full px-2.5 h-8
                      text-[12px] font-medium select-none text-white"
                :class="h.done ? 'bg-green-500' : 'bg-orange-400'">
                <!-- ✔ アイコン（色付きボックス内で白表示） -->
                <span class="shrink-0 grid place-items-center h-5 w-5 rounded-full bg-white/15">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5">
                    <path v-if="h.done" d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                    <circle v-else cx="12" cy="12" r="0.01" fill="currentColor" />
                  </svg>
                </span>

                <!-- タイトル -->
                <span class="truncate min-w-0 leading-5">{{ h.title }}</span>

                <!-- スロット バッジ -->
                <span
                  class="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded border leading-none"
                  :class="h.done
                    ? 'border-white/40 text-white/95 bg-white/10'
                    : 'border-white/35 text-white/95 bg-white/10'">
                  {{ slotShort(h.time_slot) }}
                </span>
              </button>

              <!-- 超過分は +N（未来日は habitsForDay が空なので表示されない） -->
              <button
                v-if="habitsForDay(d.iso).length > 3"
                @click="openDay(d.iso)"
                class="w-full text-[11px] py-1 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border">
                +{{ habitsForDay(d.iso).length - 3 }} 件を表示
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- 右端フェード -->
      <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white/90 to-transparent"></div>
    </div>

    <!-- ===== デスクトップ：7列グリッド ===== -->
    <div class="hidden md:block rounded-2xl bg-white shadow ring-1 ring-gray-200 overflow-hidden">
      <div class="grid grid-cols-7 divide-x divide-gray-200">
        <div v-for="d in days" :key="d.iso" class="flex flex-col h-64 border-t">
          <!-- 日付ヘッダー -->
          <div class="px-3 py-2 text-sm font-semibold text-gray-700 border-b">
            <div>{{ d.mmdd }}</div>
            <div class="text-xs text-gray-500">{{ d.dowJa }}</div>
          </div>

          <!-- 習慣（縦スクロール） -->
          <div class="flex-1 p-2 space-y-2 overflow-y-auto">
            <div
              v-for="h in habitsForDay(d.iso)"
              :key="h.id + '-' + (h.time_slot ?? 0)"
              class="px-2 py-1 rounded text-sm font-medium text-white cursor-pointer select-none flex items-center gap-2"
              :class="h.done ? 'bg-green-500' : 'bg-orange-400'"
              @click="onToggle(h, d.iso)"
              :title="h.done ? '完了' : '未完了'">
              <span v-if="h.done">✔</span>
              <span class="truncate min-w-0">{{ h.title }}</span>
              <span class="ml-auto text-[11px] bg-white/20 rounded px-1.5 py-0.5">
                {{ slotShort(h.time_slot) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- グラフ -->
    <div class="bg-white rounded-2xl shadow p-4">
      <h3 class="text-sm font-semibold mb-2">今週の達成率</h3>
      <ChartWeekly
        :labels="days.map(d => d.mmdd)"
        :values="state.rates"
        :key="graphKey"
      />
    </div>

    <!-- ストリーク -->
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-white rounded-xl shadow p-4 text-center">
        <div class="text-sm text-gray-500">現在のストリーク</div>
        <div class="text-2xl font-bold text-gray-900">{{ state.currentStreak }}日</div>
      </div>
      <div class="bg-white rounded-xl shadow p-4 text-center">
        <div class="text-sm text-gray-500">最長の連続日数</div>
        <div class="text-2xl font-bold text-gray-900">{{ state.longestStreak }}日</div>
      </div>
    </div>

    <!-- +N モーダル -->
    <div v-if="modalDayIso" class="fixed inset-0 z-50 grid place-items-center bg-black/30" @click.self="closeModal">
      <div class="w-[92vw] max-w-md rounded-2xl bg-white p-4 shadow-xl">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold">
            {{ modalHeader }}
          </h3>
          <button class="h-8 w-8 grid place-items-center rounded hover:bg-gray-100" @click="closeModal">
            ✕
          </button>
        </div>

        <div class="space-y-2 max-h-[60vh] overflow-y-auto">
          <div
            v-for="h in modalHabits"
            :key="h.id + '-' + h.time_slot"
            class="flex items-center gap-2 rounded-lg border p-2">
            <span
              class="shrink-0 h-5 w-5 rounded-full border grid place-items-center"
              :class="h.done ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300 text-transparent'">
              ✔
            </span>
            <div class="min-w-0">
              <div class="truncate text-[15px] text-gray-800">{{ h.title }}</div>
              <div class="text-xs text-gray-500">{{ slotLabel(h.time_slot) }}</div>
            </div>
            <button
              class="ml-auto text-xs px-2 py-1 rounded border hover:bg-gray-50"
              @click="onToggle(h, modalDayIso)">
              トグル
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import { useHabitBoard, toSlotNum } from '@/stores/useHabitBoard'
import ChartWeekly from '@/components/ChartWeekly.vue'
import { getCurrentSlot } from '@/composables/useSlot'
import { sortToday } from '@/composables/sortToday' // ★ STEP3: 優先度ソートを適用

/* ===== Board Store ===== */
const { state, fetchBoard, getLog, toggle, loadLogs } = useHabitBoard()

/* ===== 楽観的オーバーライド（即時反映） ===== */
const optimistic = reactive(new Map()) // key: `${habitId}|${dateISO}|${slot}` → boolean
const ok = (habitId, dateISO, slot) => `${habitId}|${dateISO}|${slot}`

/* ===== 初回ロード ===== */
onMounted(async () => {
  await fetchBoard({ silent: false })
  const startISO = iso(state.start)
  const endISO = iso(addDays(state.start, 6))
  await loadLogs(startISO, endISO)
  window.addEventListener('message', onGlobalMessage)
})
onBeforeUnmount(() => window.removeEventListener('message', onGlobalMessage))

function onGlobalMessage(e){
  const { type, payload } = e.data || {}
  if (type !== 'HABIT_LOG_UPDATED') return
  const log = payload?.habit_log
  if (!log) return

  // 週が違うなら何もしない
  const monday = mondayOf(log.date)
  if (state.start && iso(state.start) !== monday) return

  // 楽観反映
  const slot = toSlotNum(log.time_slot ?? 0)
  optimistic.set(ok(Number(log.habit_id), log.date, slot), true)

  recomputeDayRate(log.date)
}

/* ===== 日付ユーティリティ ===== */
function addDays(date, n){ const d=new Date(date); d.setDate(d.getDate()+n); return d }
function iso(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }
function mmdd(d){ return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}` }
const DOW_JA = ['日','月','火','水','木','金','土']
const todayIso = iso(new Date())

function mondayOf(isoDate) {
  const dt = new Date(isoDate + 'T00:00:00')
  const wd = (dt.getDay() + 6) % 7 // 月=0 … 日=6
  dt.setDate(dt.getDate() - wd)
  return iso(dt)
}

/* ===== 表示中の週の 7 日 ===== */
const days = computed(() =>
  Array.from({length:7},(_,i)=>{
    const dt=addDays(state.start,i)
    return { iso: iso(dt), mmdd: mmdd(dt), dowJa: DOW_JA[dt.getDay()], date: dt }
  })
)

/* ===== グラフ再描画キー ===== */
const startISO = computed(() => iso(state.start))
const endISO   = computed(() => iso(addDays(state.start, 6)))
const graphKey = computed(() => `${startISO.value}:${endISO.value}:${state.lastFetchedAt}`)

/* ===== 週タイトル ===== */
function formatRange(start){
  const end = addDays(start,6)
  return `${mmdd(start)} 〜 ${mmdd(end)}`
}

/* ===== 予定日判定 ===== */
function isPlannedOnDate(h, dateISO){
  const d = new Date(dateISO + 'T00:00:00')
  const jsDow = d.getDay()             // 日=0..土=6
  const isoDow = ((jsDow + 6) % 7) + 1 // 月=1..日=7

  if (h.start_date && dateISO < h.start_date) return false
  if (h.end_date && dateISO > h.end_date) return false

  if (Array.isArray(h.days_of_week) && h.days_of_week.length > 0) {
    return h.days_of_week.includes(isoDow) || h.days_of_week.includes(jsDow)
  }
  return true
}

/* ===== 1日分の習慣一覧（★ 優先度ソートを適用） ===== */
function habitsForDay(dateISO){
  // 未来日は表示・操作ともに無し
  if (dateISO > todayIso) return []

  // 並べ替え用コンテキスト（前チャット指示に基づく最低限の項目）
  const ctx = {
    nowISO: iso(new Date()),
    nowSlot: getCurrentSlot(),            // 1=朝,2=昼,3=夕,4=夜
    snoozedMap: new Map(),                // 実装前は空でOK
    lastDoneISO: new Map(),               // 実装前は空でOK（必要なら state.checks から集計可）
    overdueMap: new Map(),                // 実装前は空でOK
    streak: { riskByHabit: new Map() },   // 実装前は空でOK
  }

  // 対象日分の習慣を抽出 → 優先度ソート
  const sorted = sortToday(
    (state.habits ?? []).filter(h => isPlannedOnDate(h, dateISO)),
    ctx
  )

  // 表示用オブジェクトへ変換（done はログから）
  return sorted.map(h => {
    const slot = toSlotNum(h.time_slot ?? 0)
    const log  = getLog(h.id, dateISO, slot)
    const key  = ok(h.id, dateISO, slot)
    const optimisticDone = optimistic.has(key) ? optimistic.get(key) : undefined
    return {
      id: h.id,
      title: h.title,
      time_slot: slot,
      done: (optimisticDone !== undefined) ? optimisticDone : (log?.done ?? false),
    }
  })
}

/* ===== トグル ===== */
async function onToggle(h, dateISO){
  await toggle(h.id, dateISO, 'toggle', toSlotNum(h.time_slot ?? 0))
}

/* ===== 週移動 ===== */
async function shiftWeek(n){
  const d=new Date(state.start); d.setDate(d.getDate()+n*7)
  state.start = d
  await fetchBoard({ silent: true })
  const startISO = iso(state.start)
  const endISO = iso(addDays(state.start, 6))
  await loadLogs(startISO, endISO)
  optimistic.clear()
}

/* ===== その日の達成率再計算 ===== */
function recomputeDayRate(dateISO) {
  const planned = (state.habits ?? []).filter(h => isPlannedOnDate(h, dateISO))
  const den = planned.length
  if (den === 0) { setRateForDate(dateISO, 0); return }

  const doneByHabit = new Set()
  for (const h of planned) {
    const slot = toSlotNum(h.time_slot ?? 0)
    const key  = ok(h.id, dateISO, slot)
    const optimisticDone = optimistic.has(key) ? optimistic.get(key) : undefined
    const realDone = getLog(h.id, dateISO, slot)?.done === true
    const isDone = (optimisticDone !== undefined) ? optimisticDone : realDone
    if (isDone) doneByHabit.add(h.id)
  }

  const num = doneByHabit.size
  const rate = Math.round((num * 100) / den)
  setRateForDate(dateISO, rate)
}
function setRateForDate(dateISO, rate) {
  const li = (state.list ?? []).findIndex(d => d.date === dateISO)
  if (li >= 0) state.list[li].rate = rate

  const start = new Date(state.start)
  const d     = new Date(dateISO + 'T00:00:00')
  const dayIndex = Math.round((d - start) / 86400000)
  if (Array.isArray(state.rates) && dayIndex >= 0 && dayIndex < state.rates.length) {
    state.rates[dayIndex] = rate
  }
}

/* ===== スロット表記（短縮のみ） ===== */
function slotShort(n){
  switch (Number(n)||0) {
    case 1: return '朝'
    case 2: return '昼'
    case 3: return '夕'
    case 4: return '夜'
    default: return '任'
  }
}
function slotLabel(n){ return slotShort(n) }

/* ===== +N モーダル制御 ===== */
const modalDayIso = ref(null)
const modalHabits = computed(() => modalDayIso.value ? habitsForDay(modalDayIso.value) : [])
const modalHeader = computed(() => {
  if (!modalDayIso.value) return ''
  const d = new Date(modalDayIso.value + 'T00:00:00')
  return `${mmdd(d)}（${DOW_JA[d.getDay()]}）の習慣`
})
function openDay(dateIso){
  if (dateIso > todayIso) return // 未来日はモーダルを開かない
  modalDayIso.value = dateIso
}
function closeModal(){ modalDayIso.value = null }
</script>

<style scoped>
.week-scroll { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
</style>