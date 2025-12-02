<!-- resources/js/components/tabs/TodayTab.vue -->
<template>
  <div>
    <h1 class="text-2xl font-semibold mb-4">今日</h1>

    <!-- 進捗（安全ガード経由で配列を渡す） -->
    <TodayProgress
      :habits="plannedSafe"
      :get-today-log="wrapGetTodayLog"
      :timeslot="resolvedTimeslotValue"
      class="mb-4"
    />

    <TodayHeader class="mb-4" />

    <!-- ★ 今日のおすすめ（存在チェックを厳密に） -->
    <section v-if="topPickSafe && topPickSafe.h" class="mb-4 rounded border bg-white p-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-700">今日のおすすめ</h3>
        <span class="text-xs px-2 py-0.5 rounded-full border text-gray-700">
          時間帯: {{ timeslotLabel(topPickSafe.h.time_slot) }}
        </span>
      </div>
      <div class="px-2">
        <HabitRow
          :habit="topPickSafe.h"
          :log="topPickSafe.log"
          @update="onUpdate(topPickSafe.h, $event)"
        />
        <div class="flex gap-3 py-2 text-xs text-gray-600">
          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="toggleFocus(topPickSafe.h.id)"
          >
            {{ isFocused(topPickSafe.h.id) ? 'フォーカス解除' : 'フォーカス' }}
          </button>
          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="goDetail(topPickSafe.h.id)"
          >
            詳細
          </button>
        </div>
      </div>
    </section>

    <!-- 対象概要 -->
    <div class="text-sm text-gray-600 mb-2">
      対象: {{ resolvedTimeslotLabelSafe }} ／
      完了{{ ui.state.filter.showCompleted ? '含む' : '隠す' }} ／
      {{ ui.state.filter.limit === 1 ? '1件だけ' : '全件' }}
    </div>

    <!-- 上段：時間帯一致 -->
    <div class="rounded border bg-white divide-y">
      <div v-if="loadingSafe" class="p-4 text-gray-500">読み込み中...</div>

      <div v-else-if="incompleteList.length === 0" class="p-4 text-gray-500">
        今の時間帯の対象はありません。
      </div>

      <div v-for="x in incompleteList" :key="x.h.id" class="px-4">
        <HabitRow
          :habit="x.h"
          :log="x.log"
          @update="onUpdate(x.h, $event)"
        />
        <div class="flex gap-3 py-2 text-xs text-gray-600">
          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="toggleFocus(x.h.id)"
          >
            {{ isFocused(x.h.id) ? 'フォーカス解除' : 'フォーカス' }}
          </button>
          <button
            class="px-2 py-1 rounded border hover:bg-gray-50"
            @click="goDetail(x.h.id)"
          >
            詳細
          </button>
        </div>
      </div>

      <!-- 完了 -->
      <div
        v-if="ui.state.filter.showCompleted && completedList.length"
        class="p-3 bg-gray-50"
      >
        <button class="text-sm text-gray-700" @click="toggleCollapseDone">
          完了済み（{{ completedList.length }}）
          <span>{{ ui.state.collapse.done ? '▶' : '▼' }}</span>
        </button>
        <div
          v-show="!ui.state.collapse.done"
          class="mt-2 rounded border bg-white divide-y"
        >
          <div v-for="x in completedList" :key="x.h.id" class="px-4">
            <HabitRow
              :habit="x.h"
              :log="x.log"
              @update="onUpdate(x.h, $event)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 下段：いつでも -->
    <section v-if="ui.state.filter.showAnytime" class="mt-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-gray-700">いつでも</h3>
        <button class="text-sm underline" @click="shuffleAnytimeSafe">
          シャッフル
        </button>
      </div>

      <div class="rounded border bg-white divide-y">
        <div v-if="anytimeSafe.length === 0" class="p-3 text-gray-500">
          提案はありません。
        </div>
        <div v-for="x in anytimeSafe" :key="`any-incomplete-${x.h.id}`" class="px-4">
          <HabitRow
            :habit="x.h"
            :log="x.log"
            @update="onUpdate(x.h, $event)"
          />
        </div>
      </div>

      <!-- 完了済み anytime -->
      <div
        v-if="ui.state.filter.showCompleted && anyDoneSafe.length"
        class="mt-3 p-3 bg-gray-50 rounded border"
      >
        <button
          class="text-sm text-gray-700"
          @click="showCompletedAny.value = !showCompletedAny.value"
        >
          完了済み（{{ anyDoneSafe.length }}）
          <span>{{ showCompletedAny.value ? '▼' : '▶' }}</span>
        </button>
        <div
          v-show="showCompletedAny.value"
          class="mt-2 rounded border bg-white divide-y"
        >
          <div v-for="x in anyDoneSafe" :key="`any-done-${x.h.id}`" class="px-4">
            <HabitRow
              :habit="x.h"
              :log="x.log"
              @update="onUpdate(x.h, $event)"
            />
          </div>
        </div>
      </div>

      <!-- 次にやる習慣リスト -->
      <section
        v-if="(resolvedTimeslotValue === 'auto' || ['morning','noon','evening','night'].includes(resolvedTimeslotValue))
              && nextSlotSafe.length"
        class="mt-6"
      >
        <h3 class="text-sm font-semibold text-gray-700 mb-2">次にやる習慣</h3>
        <div class="rounded border bg-white divide-y">
          <div v-for="x in nextSlotSafe" :key="`next-main-${x.h.id}`" class="px-4">
            <HabitRow
              :habit="x.h"
              :log="x.log"
              @update="onUpdate(x.h, $event)"
            />
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from 'vue'
import TodayHeader from '@/components/today/TodayHeader.vue'
import HabitRow from '@/components/today/HabitRow.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import { useTodayTab } from '@/composables/useTodayTab'
import { priorityScore } from '@/domain/priority'
import { useHabitBoard } from '@/stores/useHabitBoard'
import { toSlotNum } from '@/domain/timeutil'
import axios from 'axios'

/* =========================
 * useTodayTab()（未定義に備えて安全に受ける）
 * ========================= */
const tt = useTodayTab?.() ?? {}

// 既存のストア/コンポーザブルがあればそれを利用。無ければローカル状態で代替。
const ui                 = tt.ui ?? reactive({ state:{ filter:{ showCompleted:false, showAnytime:true, limit:0 }, collapse:{ done:false } } })
const loading            = tt.loading ?? ref(false)
const showCompletedAny   = tt.showCompletedAny ?? ref(false)
const getLogStore        = tt.getLog ?? null
const plannedHabits      = tt.plannedHabits ?? ref(null)
const resolvedTimeslot   = tt.resolvedTimeslot ?? ref('auto')
const todayYmdFn         = tt.todayYmd ?? (() => new Date().toISOString().slice(0,10))
const topPickStore       = tt.topPick ?? null
const isFocused          = tt.isFocused ?? (() => false)
const toggleFocus        = tt.toggleFocus ?? (() => {})
const toggleCollapseDone = tt.toggleCollapseDone ?? (() => { ui.state.collapse.done = !ui.state.collapse.done })
const goDetail           = tt.goDetail ?? (() => {})
const anytimeStore       = tt.anytime ?? ref(null)
const shuffleAnytime     = tt.shuffleAnytime ?? null
const resolvedTimeslotLabelStore = tt.resolvedTimeslotLabel ?? null
const timeslotLabelStore = tt.timeslotLabel ?? null
const getTodayLogStore   = tt.getTodayLog ?? null
const nextSlotHabits     = tt.nextSlotHabits ?? ref(null)
const anyDoneStore       = tt.anyDone ?? ref(null)

/* =========================
 * ローカル状態（/api/today フォールバック）
 * ========================= */
const plannedLocal  = ref([])              // [{id,title,time_slot,...}]
const logsByHabit   = reactive(new Map())  // habit_id -> today_log
const topPickLocal  = ref(null)            // { h, log }
const anytimeLocal  = ref([])              // 同形
const anyDoneLocal  = ref([])              // 同形
const nextSlotLocal = ref([])              // 同形
const loadingLocal  = ref(false)

const todayISO = computed(() => todayYmdFn())

/* =========================
 * ラベル/時間帯ユーティリティ（ローカル実装）
 * ========================= */
function autoTimeslot() {
  const h = new Date().getHours()
  if (h >= 5 && h <= 10)  return 'morning'
  if (h >= 11 && h <= 14) return 'noon'
  if (h >= 15 && h <= 18) return 'evening'
  return 'night' // 19-4
}
const resolvedTimeslotValue = computed(() => {
  const v = typeof resolvedTimeslot === 'object' ? resolvedTimeslot.value : resolvedTimeslot
  return v === 'auto' ? 'auto' : (v || 'auto')
})
const resolvedTimeslotLabelSafe = computed(() => {
  if (resolvedTimeslotLabelStore) return resolvedTimeslotLabelStore
  const t = resolvedTimeslotValue.value === 'auto' ? autoTimeslot() : resolvedTimeslotValue.value
  const map = { morning:'朝', noon:'昼', evening:'夕方', night:'夜', all:'すべて', auto:'自動' }
  return map[t] ?? 'すべて'
})
function timeslotLabelLocal(n) {
  const map = { 0:'いつでも',1:'朝',2:'昼',3:'夕方',4:'夜' }
  return map[n] ?? String(n ?? '')
}
const timeslotLabel = (v) => timeslotLabelStore ? timeslotLabelStore(v) : timeslotLabelLocal(v)

/* =========================
 * 安全ガード（tt優先→ローカル）
 * ========================= */
const loadingSafe = computed(() => (typeof loading?.value === 'boolean') ? loading.value : loadingLocal.value)

const plannedSafe = computed(() => {
  if (Array.isArray(plannedHabits?.value)) return plannedHabits.value
  return plannedLocal.value
})
const anytimeSafe = computed(() => {
  if (Array.isArray(anytimeStore?.value)) return anytimeStore.value
  return anytimeLocal.value
})
const anyDoneSafe = computed(() => {
  if (Array.isArray(anyDoneStore?.value)) return anyDoneStore.value
  return anyDoneLocal.value
})
const nextSlotSafe = computed(() => {
  if (Array.isArray(nextSlotHabits?.value)) return nextSlotHabits.value
  return nextSlotLocal.value
})
const topPickSafe = computed(() => topPickStore ?? topPickLocal.value ?? null)

const shuffleAnytimeSafe = async () => {
  if (typeof shuffleAnytime === 'function') return shuffleAnytime()
  anytimeLocal.value = [...anytimeLocal.value].sort(() => Math.random() - 0.5)
}

/* =========================
 * TodayProgress 用の安全ラッパ
 * ========================= */
function wrapGetTodayLog(id) {
  if (getTodayLogStore) {
    try { return getTodayLogStore(id) } catch { /* noop */ }
  }
  return logsByHabit.get(id) ?? null
}

/* =========================
 * 楽観更新
 * ========================= */
const { isDone, toggle } = useHabitBoard()
const optimistic = reactive({}) // key: string -> boolean
const ok = (habitId, dateISO, slot) => `${habitId}|${dateISO}|${slot}`

function setOptimistic(habitId, dateISO, slot, val) {
  optimistic[ok(habitId, dateISO, slot)] = !!val
}
function getOptimistic(habitId, dateISO, slot) {
  const v = optimistic[ok(habitId, dateISO, slot)]
  return v === true
}
function doneFor(habitId, dateISO, slot) {
  if (Object.prototype.hasOwnProperty.call(optimistic, ok(habitId, dateISO, slot))) {
    return getOptimistic(habitId, dateISO, slot)
  }
  try {
    return isDone(habitId, dateISO, slot)
  } catch {
    const log = wrapGetTodayLog(habitId)
    return (log?.status === 'done')
  }
}

/* =========================
 * グローバルイベント受信
 * ========================= */
function onGlobalMessage(e) {
  const { type, payload } = e?.data || {}

  if (type === 'HABIT_LOG_UPDATED') {
    const log = payload?.habit_log
    if (!log) return
    if (log.date !== todayISO.value) return
    const slot = toSlotNum(log.time_slot ?? 0)
    setOptimistic(Number(log.habit_id), log.date, slot, true)
    // ローカルのログMapも更新
    logsByHabit.set(Number(log.habit_id), log)
    return
  }

  if (type === 'REMIND_SCHEDULED') {
    // 任意のUI処理を差し込むならここ
    return
  }
}
onMounted(() => window.addEventListener('message', onGlobalMessage))
onBeforeUnmount(() => window.removeEventListener('message', onGlobalMessage))

/* =========================
 * 更新処理（セル操作）
 * ========================= */
async function onUpdate(h, payload) {
  if (!h) return
  if (payload?.rating !== undefined) {
    await toggle(h.id, todayISO.value, 'rating', toSlotNum(h.time_slot ?? 0), payload.rating)
    // ローカル更新
    const cur = logsByHabit.get(h.id)
    if (cur) logsByHabit.set(h.id, { ...cur, rating: payload.rating })
    return
  }

  if (payload?.status) {
    const date = todayISO.value
    const slot = toSlotNum(h.time_slot ?? 0)
    const nextVal = !doneFor(h.id, date, slot)
    setOptimistic(h.id, date, slot, nextVal)
    try {
      await toggle(h.id, date, 'toggle', slot)
      // ローカル更新
      const cur = logsByHabit.get(h.id)
      const newStatus = nextVal ? 'done' : 'none'
      if (cur) logsByHabit.set(h.id, { ...cur, status: newStatus })
      else logsByHabit.set(h.id, { habit_id: h.id, date, time_slot: slot, status: newStatus })
    } catch {
      setOptimistic(h.id, date, slot, !nextVal)
    }
  }
}

/* =========================
 * リスト（完了/未完）
 * ========================= */
const currentSlotKey = computed(() => {
  const cur = resolvedTimeslotValue.value
  if (cur === 'auto') return autoTimeslot()
  return cur
})

const incompleteList = computed(() => {
  const map = { 1: 'morning', 2: 'noon', 3: 'evening', 4: 'night' }
  const cur = currentSlotKey.value

  let list = plannedSafe.value
    .filter(h => h && h.time_slot !== 0)
    .filter(h => cur === 'all' ? true : map[h.time_slot] === cur)
    .map(h => ({ h, log: wrapGetTodayLog(h.id) }))
    .filter(x => !doneFor(x.h.id, todayISO.value, x.h.time_slot))

  // ✅ 常に優先度の高い順へソート
  list = list.sort((a, b) => (priorityScore(b.h) ?? 0) - (priorityScore(a.h) ?? 0))

  // 「今日一個だけ表示」がONなら先頭1件に絞る
  return (ui?.state?.filter?.limit === 1) ? list.slice(0, 1) : list
})

const completedList = computed(() => {
  const map = { 1: 'morning', 2: 'noon', 3: 'evening', 4: 'night' }
  const cur = currentSlotKey.value

  return plannedSafe.value
    .filter(h => h && h.time_slot !== 0)
    .filter(h => cur === 'all' ? true : map[h.time_slot] === cur)
    .map(h => ({ h, log: wrapGetTodayLog(h.id) }))
    .filter(x => doneFor(x.h.id, todayISO.value, x.h.time_slot))
})

/* =========================
 * データ取得（フォールバック：/api/habits/init-today → /api/today）
 * ========================= */
async function initTodayOnce() {
  try { await axios.post('/api/habits/init-today', {}, { withCredentials: true }) } catch { /* noop */ }
}

async function loadTodayFromApi() {
  // 既存のストアが供給してくれるなら何もしない
  if (Array.isArray(plannedHabits?.value)) return

  loadingLocal.value = true
  try {
    const { data } = await axios.get('/api/today', { withCredentials: true })
    // planned: [{ h, today_log, pending_task }]
    const planned = Array.isArray(data?.planned) ? data.planned : []

    // Habits
    plannedLocal.value = planned.map(x => x.h).filter(Boolean)

    // Logs
    logsByHabit.clear()
    planned.forEach(x => {
      if (x.today_log && x.h) logsByHabit.set(x.h.id, x.today_log)
    })

    // top pick
    topPickLocal.value = (data?.top_pick && planned.length)
      ? (() => {
          const pickHabitId = data.top_pick.habit_id
          const h = planned.find(x => x.h?.id === pickHabitId)?.h ?? null
          const log = h ? logsByHabit.get(h.id) ?? null : null
          return h ? { h, log } : null
        })()
      : null

    // anytime/anyDone/nextSlot: ここでは簡易に空のまま。必要に応じてサーバ側拡張に合わせて充填。
    anytimeLocal.value = plannedLocal.value
      .filter(h => h.time_slot === 0)
      .map(h => ({ h, log: logsByHabit.get(h.id) ?? null }))

    anyDoneLocal.value = []
    nextSlotLocal.value = plannedLocal.value
      .filter(h => h.time_slot !== 0)
      .map(h => ({ h, log: logsByHabit.get(h.id) ?? null }))

  } finally {
    loadingLocal.value = false
  }
}

/* =========================
 * マウント時の流れ
 * ========================= */
onMounted(async () => {
  if (!Array.isArray(plannedHabits?.value)) {
    await initTodayOnce()
    await loadTodayFromApi()
  }
})
</script>