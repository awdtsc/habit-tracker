<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import { computed, onMounted, unref } from 'vue'

import TodayHeader from '@/components/today/TodayHeader.vue'
import TodayTopPickCard from '@/components/today/TodayTopPickCard.vue'
import TodayActionableSection from '@/components/today/TodayActionableSection.vue'
import TodayAnytimeSection from '@/components/today/TodayAnytimeSection.vue'
import TodayNextSlotSection from '@/components/today/TodayNextSlotSection.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import TodayDoneSection from '@/components/today/TodayDoneSection.vue'

import { useAuthStore } from '@/stores/auth'
import { useTodayState } from '@/composables/useTodayState'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import { useTodayTab } from '@/composables/useTodayTab'

/* ============================================================
 * Stores
 * ============================================================ */
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
 * ============================================================ */
onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.fetchToday()
  }
})

/* ============================================================
 * Helpers
 * ============================================================ */
const normalize = (raw) => {
  const v = unref(raw)
  return Array.isArray(v) ? v : []
}

const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

/* ============================================================
 * Progress（★100%安全に動く形）
 * ============================================================ */
const progress = computed(() => {
  const p = tab.progress?.value
  if (!p) return { total: 0, completed: 0, rate: 0 }

  return {
    total: Number(p.total ?? 0),
    completed: Number(p.completed ?? 0),
    rate: p.rate ?? (p.total ? p.completed / p.total : 0),
  }
})

/* ============================================================
 * UI state
 * ============================================================ */
const activeSlot = computed(() => unref(tab.activeSlot))
const isAll      = computed(() => activeSlot.value == null)

const activeSlotLabel = computed(() => {
  const s = activeSlot.value
  return s == null ? 'すべて' : (SLOT_LABEL[s] ?? '—')
})

const showNextSlot = computed(() => {
  const f = tab.ui?.state?.filter ?? {}
  return (f.timeslot ?? 'auto') === 'auto'
})

/* Lists */
const allActionable = computed(() =>
  isAll.value ? normalize(tab.allActionable) : []
)
const allDone = computed(() =>
  isAll.value ? normalize(tab.allDone) : []
)

const slotActionable = computed(() =>
  isAll.value ? [] : normalize(tab.slotActionable)
)
const slotDone = computed(() =>
  isAll.value ? [] : normalize(tab.slotDone)
)

const anytimeActionable = computed(() =>
  isAll.value ? [] : normalize(tab.anytimeActionable)
)
const anytimeDone = computed(() =>
  isAll.value ? [] : normalize(tab.anytimeDone)
)

const nextSlot       = computed(() => unref(tab.nextSlot) ?? null)
const nextSlotHabits = computed(() => normalize(tab.nextSlotHabits))

/* ============================================================
 * Events
 * ============================================================ */
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

    <!-- Progress -->
    <TodayProgress :progress="progress" />

    <TodayHeader />

    <!-- Top Pick -->
    <TodayTopPickCard
      v-if="tab.topPick && tab.topPick.h"
      :top-pick="tab.topPick"
      :timeslot-label="tab.timeslotLabel"
      :on-row-update="onRowUpdate"
    />

    <!-- All -->
    <template v-if="isAll">
      <section class="mt-6">
        <h2 class="text-lg font-semibold mb-2">すべて（未完了）</h2>
        <TodayActionableSection
          :items="allActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
          :is-focused="tab.isFocused"
          :toggle-focus="tab.toggleFocus"
        />
      </section>

      <TodayDoneSection
        :show-completed="true"
        :collapsed="tab.ui.state.collapse.done"
        :items="allDone"
        :on-row-update="onRowUpdate"
        @toggle-collapse-done="tab.toggleCollapseDone"
      />
    </template>

    <!-- Per Slot -->
    <template v-else>
      <section class="mt-6">
        <h2 class="text-lg font-semibold mb-2">{{ activeSlotLabel }}の習慣</h2>
        <TodayActionableSection
          :items="slotActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
          :is-focused="tab.isFocused"
          :toggle-focus="tab.toggleFocus"
        />
      </section>

      <TodayAnytimeSection
        v-if="anytimeActionable.length"
        :items="anytimeActionable"
        :on-row-update="onRowUpdate"
      />

      <TodayNextSlotSection
        v-if="showNextSlot && nextSlot"
        :next-slot="nextSlot"
        :items="nextSlotHabits"
        :on-row-update="onRowUpdate"
      />

      <TodayDoneSection
        :show-completed="tab.ui.state.filter.showCompleted"
        :collapsed="tab.ui.state.collapse.done"
        :items="slotDone"
        :on-row-update="onRowUpdate"
        @toggle-collapse-done="tab.toggleCollapseDone"
      />

      <TodayDoneSection
        v-if="anytimeDone.length"
        :show-completed="true"
        :collapsed="false"
        :items="anytimeDone"
        :on-row-update="onRowUpdate"
      />
    </template>
  </div>
</template>
