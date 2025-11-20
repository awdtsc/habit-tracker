<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import TodayHeader from '@/components/today/TodayHeader.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import TodayTopPickCard from '@/components/today/TodayTopPickCard.vue'
import TodayActionableSection from '@/components/today/TodayActionableSection.vue'
import TodayAnytimeSection from '@/components/today/TodayAnytimeSection.vue'
import TodayNextSlotSection from '@/components/today/TodayNextSlotSection.vue'
import TodayDoneSection from '@/components/today/TodayDoneSection.vue'

import { computed, onMounted, unref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTodayState } from '@/composables/useTodayState'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import { useTodayTab } from '@/composables/useTodayTab'

/* ============================================================
 * Stores
 * ========================================================== */
const core   = useTodayState()
const auth   = useAuthStore()
const weekly = useWeeklyBoard()
const tab    = useTodayTab(core)

/* Debug */
if (typeof window !== 'undefined') {
  window.__today    = core
  window.__todayTab = tab
  window.__weekly   = weekly
}

/* ============================================================
 * Lifecycle
 * ========================================================== */
onMounted(async () => {
  console.log('[TodayTab] mounted')

  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.fetchToday()
  }
})

/* ============================================================
 * Helpers
 * ========================================================== */
const normalizeArray = (raw) => {
  const v = unref(raw)
  return Array.isArray(v) ? v : []
}

/* ============================================================
 * Lists / Data mapping
 * ========================================================== */

// 進捗バー用
const plannedHabits = computed(() => normalizeArray(tab.plannedHabits))

// slot grouping
const SLOT_LABEL = ['', '朝', '昼', '夕', '夜']

const bySlot = computed(() => {
  const g =
    tab.bySlot ??
    tab.lists?.bySlot?.value ??
    { 0: [], 1: [], 2: [], 3: [], 4: [] }

  return g
})

/* ★ 現在のタブ（朝 / 昼 / 夕 / 夜 / すべて）に応じて表示する slot を決める */
const timeslotFilter = computed(() => {
  const s = tab?.ui?.state ?? {}

  return (
    // どれかに入っている想定。なければ 'all'
    s.timeslot ??
    s.slot ??
    s.currentSlot ??
    (s.filter && (s.filter.timeslot ?? s.filter.slot)) ??
    'all'
  )
})

const visibleSlots = computed(() => {
  const v = timeslotFilter.value

  // すべて / 自動 → 全スロット
  if (v === 'all' || v === 'auto' || v === 'auto_slot' || v == null) {
    return [1, 2, 3, 4]
  }

  // 朝
  if (
    v === 'morning' ||
    v === 'am' ||
    v === '朝' ||
    v === 1 ||
    v === '1'
  ) {
    return [1]
  }

  // 昼
  if (
    v === 'noon' ||
    v === 'day' ||
    v === '昼' ||
    v === 2 ||
    v === '2'
  ) {
    return [2]
  }

  // 夕
  if (
    v === 'evening' ||
    v === '夕' ||
    v === 3 ||
    v === '3'
  ) {
    return [3]
  }

  // 夜
  if (
    v === 'night' ||
    v === 'pm' ||
    v === '夜' ||
    v === 4 ||
    v === '4'
  ) {
    return [4]
  }

  // よく分からない値なら一旦全部出す
  return [1, 2, 3, 4]
})

// その他のリスト
const anytime        = computed(() => normalizeArray(tab.anytime))
const nextSlot       = computed(() => unref(tab.nextSlot) ?? null)
const nextSlotHabits = computed(() => normalizeArray(tab.nextSlotHabits))
const done           = computed(() => normalizeArray(tab.done))

/* ============================================================
 * Events
 * ========================================================== */
function onRowUpdate(habit, payload = {}) {
  if (!habit) return
  tab.onUpdate({
    id: habit.id,
    status: payload.status,
    value: payload.value,
    rating: payload.rating,
  })
}

function goDetail(id) {
  const href = `/habits/${id}`
  if (window?.$router) {
    window.$router.push(href)
  } else {
    location.assign(href)
  }
}
</script>

<template>
  <div class="p-4 md:p-6 space-y-6">
    <!-- Header -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">今日</h1>
        <p class="text-sm text-gray-500">{{ tab.ymd(new Date()) }}</p>
      </div>
    </header>

    <!-- Progress Bar -->
    <TodayProgress
      :habits="plannedHabits"
      :get-today-log="tab.getTodayLog"
      timeslot="all"
    />

    <TodayHeader />

    <!-- Top Pick -->
    <TodayTopPickCard
      v-if="tab.topPick && tab.topPick.h"
      :top-pick="tab.topPick"
      :timeslot-label="tab.timeslotLabel"
      :on-row-update="onRowUpdate"
    />

    <!-- ===================================================== -->
    <!-- 朝・昼・夕・夜ごとの「今やる候補」                     -->
    <!--   → 朝タブなら朝だけ、夕タブなら夕だけ、              -->
    <!--     すべてタブなら4つ全部表示                          -->
    <!-- ===================================================== -->
    <section
      v-for="slot in visibleSlots"
      :key="slot"
      class="mt-6"
    >
      <h2 class="text-lg font-semibold mb-2">
        {{ SLOT_LABEL[slot] }}の習慣
      </h2>

      <TodayActionableSection
        :items="bySlot[slot]"
        :on-row-update="onRowUpdate"
        :go-detail="goDetail"
        :loading="false"
        :is-focused="tab.isFocused"
        :toggle-focus="tab.toggleFocus"
      />

      <div
        v-if="bySlot[slot]?.length === 0"
        class="text-sm text-gray-400 pl-1"
      >
        （{{ SLOT_LABEL[slot] }}の習慣なし）
      </div>
    </section>

    <!-- いつでも -->
    <TodayAnytimeSection
      :items="anytime"
      :on-row-update="onRowUpdate"
    />

    <!-- 次の時間帯 -->
    <TodayNextSlotSection
      :next-slot="nextSlot"
      :items="nextSlotHabits"
      :on-row-update="onRowUpdate"
    />

    <!-- 完了 -->
    <TodayDoneSection
      :show-completed="tab.ui.state.filter.showCompleted"
      :collapsed="tab.ui.state.collapse.done"
      :items="done"
      :on-row-update="onRowUpdate"
      @toggle-collapse-done="tab.toggleCollapseDone"
    />
  </div>
</template>
