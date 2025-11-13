<!-- resources/js/components/tabs/TodayTab.vue -->
<template>
  <div class="p-4 md:p-6 space-y-6">
    <!-- タイトル（シンプルに戻す） -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">今日</h1>
        <p class="text-sm text-gray-500">
          {{ ymd(new Date()) }}
        </p>
      </div>
      <!-- 右側の操作ボタンは削除（TodayHeaderに集約） -->
    </header>

    <!-- 進捗 -->
    <TodayProgress
      :habits="plannedHabits"
      :get-today-log="getTodayLog"
      :timeslot="resolvedTimeslot"
    />

    <!-- タブ&フィルタバー（操作はここに集約） -->
    <TodayHeader />

    <!-- ★ Top Pick: “すべて”タブの時だけ表示 -->
    <section
      v-if="resolvedTimeslot === 'all' && topPick"
      class="rounded-2xl border p-4 bg-amber-50">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs font-semibold text-amber-700">いまのおすすめ</div>
          <div class="text-lg font-semibold">{{ topPick.h.title || topPick.h.name }}</div>
          <div class="text-xs text-gray-500">
            スロット: {{ timeslotLabel(slotStr(topPick.h.time_slot)) }}
          </div>
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white"
            @click="onRowUpdate(topPick.h, { status: 'done', value: true })">
            完了にする
          </button>
          <button
            class="px-3 py-1.5 text-sm rounded-md border"
            @click="openRemindModal(topPick.h.id)">
            後で（通知）
          </button>
        </div>
      </div>
    </section>

    <!-- 対象の説明（簡潔に維持） -->
    <div class="text-sm text-gray-600">
      対象: {{ resolvedTimeslotLabel }} ／
      完了{{ ui.state.filter.showCompleted ? '含む' : '隠す' }} ／
      {{ ui.state.filter.limit === 1 ? '1件だけ' : '全件' }}
    </div>

    <!-- いまやるべき -->
    <section class="rounded-2xl border bg-white divide-y">
      <div v-if="loading" class="p-4 text-gray-500">読み込み中…</div>
      <template v-else>
        <div v-if="!actionableOnly.length" class="p-4 text-gray-500">いまやる項目はありません。</div>
        <div v-for="x in actionableOnly" :key="'act-' + x.h.id" class="px-4 py-3">
          <HabitRow :habit="x.h" :log="x.log" @update="(e) => onRowUpdate(x.h, e)" />
          <div class="flex gap-3 py-2 text-xs text-gray-600">
            <button class="px-2 py-1 rounded border hover:bg-gray-50" @click="toggleFocus(x.h.id)">
              {{ isFocused(x.h.id) ? 'フォーカス解除' : 'フォーカス' }}
            </button>
            <button class="px-2 py-1 rounded border hover:bg-gray-50" @click="goDetail(x.h.id)">
              詳細
            </button>
          </div>
        </div>
      </template>
    </section>

    <!-- anytime -->
    <section v-if="anytimeDisplay.length" class="space-y-2">
      <h2 class="text-sm font-semibold text-gray-700">いつでも</h2>
      <div class="rounded-2xl border bg-white divide-y">
        <div v-for="x in anytimeDisplay" :key="'any-' + x.h.id" class="px-4 py-3">
          <HabitRow :habit="x.h" :log="x.log" @update="(e) => onRowUpdate(x.h, e)" />
        </div>
      </div>
    </section>

    <!-- 次の時間帯 -->
    <section v-if="nextSlotHabits.length" class="space-y-2">
      <h2 class="text-sm font-semibold text-gray-700">次の時間帯（{{ nextSlot }}）</h2>
      <div class="rounded-2xl border bg-white divide-y">
        <div v-for="x in nextSlotHabits" :key="'next-' + x.h.id" class="px-4 py-3">
          <HabitRow :habit="x.h" :log="x.log" @update="(e) => onRowUpdate(x.h, e)" />
        </div>
      </div>
    </section>

    <!-- 完了 -->
    <section v-if="ui.state.filter.showCompleted" class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-700">完了</h2>
        <button class="text-sm underline" @click="toggleCollapseDone()">
          {{ ui.state.collapse.done ? '完了を表示' : '完了を隠す' }}
        </button>
      </div>
      <div v-show="!ui.state.collapse.done" class="rounded-2xl border bg-white divide-y">
        <div v-if="!done.length" class="p-4 text-gray-500">完了した項目はありません。</div>
        <div v-for="x in done" :key="'done-' + x.h.id" class="px-4 py-3 bg-gray-50/60">
          <HabitRow :habit="x.h" :log="x.log" @update="(e) => onRowUpdate(x.h, e)" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import TodayHeader from '@/components/today/TodayHeader.vue'
import HabitRow from '@/components/today/HabitRow.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import axios from '@/axios'
import { useTodayTab } from '@/composables/useTodayTab'

const {
  ui, loading,
  plannedHabits,
  resolvedTimeslot, resolvedTimeslotLabel, timeslotLabel,
  topPick, actionableOnly, done,
  anytimeDisplay, nextSlotHabits, nextSlot,
  isFocused, toggleFocus, toggleCollapseDone,
  getTodayLog, onUpdate, ymd,
} = useTodayTab()

function onRowUpdate(habit, payload = {}) {
  onUpdate({
    id: habit.id,
    status: payload.status,
    value: payload.value,
    rating: payload.rating,
  })
}

const slotStr = (v) => {
  const n = Number(v || 0)
  if (n === 1) return 'morning'
  if (n === 2) return 'noon'
  if (n === 3) return 'evening'
  if (n === 4) return 'night'
  return 'flex'
}

function goDetail(id) {
  try {
    const href = `/habits/${id}`
    if (window?.$router) window.$router.push(href)
    else location.assign(href)
  } catch {
    location.assign(`/habits/${id}`)
  }
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
    console.error('[TodayTab] openRemindModal failed', e?.response?.data || e)
  }
}
</script>