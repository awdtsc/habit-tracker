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
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  // ✅ ログイン直後は必ず「自動」タブからスタートさせる
  if (core.ui?.state?.filter) {
    core.ui.state.filter.timeslot = 'auto'
  }

  // WeeklyBoard 自体は他タブで使うので、今日タブでも同期だけは取る
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

const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

const activeSlotLabel = computed(() => {
  const s = unref(tab.activeSlot)
  return s == null ? 'すべて' : SLOT_LABEL[s] ?? '—'
})

/** 「次の時間帯」を表示するか？
 *  - 自動タブ（timeslot === 'auto'）のときだけ表示
 *  - 朝/昼/夕/夜/すべてタブでは出さない
 */
const showNextSlot = computed(() => {
  const f = tab.ui?.state?.filter ?? {}
  const v = f.timeslot ?? f.slot ?? 'auto'
  return v === 'auto'
})

/* ============================================================
 * Lists / Data mapping
 * ========================================================== */
const actionable     = computed(() => normalizeArray(tab.actionable))
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

    <!-- Progress Bar（anytime を除外した値を渡す） -->
    <TodayProgress
      v-if="tab.progress"
      :progress="tab.progress"
    />

    <TodayHeader />

    <!-- Top Pick -->
    <TodayTopPickCard
      v-if="tab.topPick && tab.topPick.h"
      :top-pick="tab.topPick"
      :timeslot-label="tab.timeslotLabel"
      :on-row-update="onRowUpdate"
    />

    <!-- メインのアクションリスト（時間帯タブに応じてフィルタ済み） -->
    <section class="mt-6">
      <h2 class="text-lg font-semibold mb-2">
        {{ activeSlotLabel }}の習慣
      </h2>

      <TodayActionableSection
        :items="actionable"
        :on-row-update="onRowUpdate"
        :go-detail="goDetail"
        :loading="false"
        :is-focused="tab.isFocused"
        :toggle-focus="tab.toggleFocus"
      />
    </section>

    <!-- いつでも -->
    <TodayAnytimeSection
      :items="anytime"
      :on-row-update="onRowUpdate"
    />

    <!-- 次の時間帯（自動タブのときだけ） -->
    <TodayNextSlotSection
      v-if="showNextSlot && nextSlot"
      :next-slot="nextSlot"
      :items="nextSlotHabits"
      :on-row-update="onRowUpdate"
    />

    <!-- 完了（時間帯 1..4 のみ） -->
    <TodayDoneSection
      :show-completed="tab.ui.state.filter.showCompleted"
      :collapsed="tab.ui.state.collapse.done"
      :items="done"
      :on-row-update="onRowUpdate"
      @toggle-collapse-done="tab.toggleCollapseDone"
    />
  </div>
</template>