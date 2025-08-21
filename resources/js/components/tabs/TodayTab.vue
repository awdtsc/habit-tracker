<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import { computed, onMounted } from 'vue'
import { useHabitBoard } from '@/stores/useHabitBoard'
import HabitsIndex from '@/components/HabitsIndex.vue'

const { state, todayISO, fetchBoard, toggle, hydrateFromSnapshot, isFresh } = useHabitBoard()

// 初回：スナップショットで即表示 → 必要ならサイレント再取得
onMounted(() => {
  const hadSnap = hydrateFromSnapshot()
  if (!isFresh(60_000) || !state.habits.length) {
    fetchBoard({ silent: hadSnap && state.habits.length > 0 })
  }
})

/* 表示ヘルパ */
const key = (hid, iso) => `${hid}|${iso}`
const isCheckedToday = (hid) => !!state.checks[key(hid, todayISO)]

function jpDateWithDow(d) {
  const w = ['日','月','火','水','木','金','土'][d.getDay()]
  return `${d.getMonth()+1}/${d.getDate()}(${w})`
}

function shownToday(h) {
  const dow = ((new Date().getDay() + 6) % 7) + 1 // 1..7 Mon..Sun
  switch (h?.frequency_type) {
    case 'daily':    return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekends': return dow === 6 || dow === 7
    case 'custom':   return Array.isArray(h?.days_of_week) && h.days_of_week.map(Number).includes(dow)
    case 'quota':    return true
    default:         return true
  }
}
function activeByDate(h) {
  if (h?.start_date && todayISO < h.start_date) return false
  if (h?.end_date   && todayISO > h.end_date)   return false
  return true
}
const isDisabled = (h) => !(shownToday(h) && activeByDate(h))

/* 今日の対象と進捗 */
const candidates = computed(() => state.habits.filter(h => shownToday(h) && activeByDate(h)))
const doneCount  = computed(() => candidates.value.filter(h => isCheckedToday(h.id)).length)
const totalCount = computed(() => candidates.value.length)
const percent    = computed(() => totalCount.value ? Math.round(doneCount.value * 100 / totalCount.value) : 0)

/* グループ（時間帯） */
const SLOT_META = {
  morning: { label: '朝の習慣', emoji: '🌅' },
  noon:    { label: '昼の習慣', emoji: '☀️' },
  evening: { label: '夕の習慣', emoji: '🌆' },
  night:   { label: '夜の習慣', emoji: '🌙' },
  anytime: { label: 'いつでも', emoji: '🕒' },
}
const slotOrder = ['morning','noon','evening','night','anytime']
const groups = computed(() => {
  const map = Object.fromEntries(slotOrder.map(s => [s, []]))
  for (const h of state.habits) (map[SLOT_META[h.time_slot] ? h.time_slot : 'anytime']).push(h)
  return slotOrder
    .map(s => ({ id: s, ...SLOT_META[s], items: map[s].filter(h => shownToday(h) && activeByDate(h)) }))
    .filter(g => g.items.length)
})

/* トグルは store 経由（楽観更新 → 週グラフも即連動） */
const onToggleToday = (hid, checked) => toggle(hid, todayISO, checked)
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 space-y-6">
    <!-- 見出し -->
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900">おはよう！</h1>
      <div class="mt-1 text-gray-500">{{ jpDateWithDow(new Date()) }}</div>
    </div>

    <!-- 今日の進捗 -->
    <div class="rounded-2xl bg-white ring-1 ring-blue-200 px-6 py-4">
      <div class="text-center text-sm text-blue-600">今日の進捗</div>
      <div class="mt-1 text-center">
        <div class="text-4xl font-extrabold tracking-widest text-gray-900 tabular-nums">
          {{ doneCount }} / {{ totalCount }}
        </div>
        <div class="mt-1 text-blue-600 text-sm">{{ percent }}% 完了</div>
      </div>
    </div>

    <!-- 初回だけ（スナップショットが無い時）短時間出る可能性あり -->
    <div v-if="state.loading && !state.habits.length" class="text-center text-gray-500 py-10">
      読み込み中…
    </div>

    <!-- 今日の習慣リスト -->
    <div v-else class="space-y-6">
      <section v-for="g in groups" :key="g.id" class="space-y-2">
        <div class="flex items-center gap-2 text-gray-900 font-semibold">
          <span class="text-lg">{{ g.emoji }}</span>
          <span>{{ g.label }}</span>
          <span class="text-sm text-gray-500">
            （{{ g.items.filter(h => isCheckedToday(h.id)).length }}/{{ g.items.length }}完了）
          </span>
        </div>

        <div class="space-y-3">
          <div
            v-for="h in g.items"
            :key="h.id"
            class="bg-white ring-1 ring-blue-200 rounded-none shadow"
            :class="isDisabled(h) ? 'opacity-50' : ''"
          >
            <div class="h-14 w-full flex items-center px-6">
              <!-- タイトル -->
              <div class="flex-1 min-w-0">
                <span class="truncate text-gray-900 font-medium leading-none h-6">{{ h.title }}</span>
              </div>

              <!-- バッジ＋チェック -->
              <div class="ml-auto flex items-center gap-4">
                <span
                  :class="[
                    'inline-flex items-center h-6 px-3 rounded-full text-xs whitespace-nowrap border',
                    (isCheckedToday(h.id) && !isDisabled(h))
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : (isDisabled(h)
                          ? 'bg-slate-100 text-slate-500 border-slate-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300')
                  ]"
                >
                  {{ (isCheckedToday(h.id) && !isDisabled(h)) ? '達成済み' : (isDisabled(h) ? '対象外' : '未完了') }}
                </span>

                <input
                  type="checkbox"
                  class="size-5 text-indigo-600 rounded focus:ring-0 focus:outline-none"
                  :class="{'opacity-50 cursor-not-allowed': isDisabled(h)}"
                  :disabled="isDisabled(h)"
                  :checked="isCheckedToday(h.id)"
                  @change="onToggleToday(h.id, $event.target.checked)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div v-if="groups.length===0" class="text-center text-gray-500 py-10">
        今日予定されている習慣はありません
      </div>

      <!-- ▼ ここから：習慣カード（詳細・編集/削除）を Today の下に表示 -->
   <section class="pt-6">
     <HabitsIndex />
   </section>
    </div>
  </div>
</template>