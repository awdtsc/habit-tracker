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

  if (core.ui?.state?.filter) {
    core.ui.state.filter.timeslot = 'auto'
  }

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.fetchToday()
  }
})

/* ============================================================
 * Helpers
 * ========================================================== */
const normalize = (raw) => {
  const v = unref(raw)
  return Array.isArray(v) ? v : []
}

const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

const activeSlotLabel = computed(() => {
  const s = unref(tab.activeSlot)
  return s == null ? 'すべて' : SLOT_LABEL[s] ?? '—'
})

/* 自動タブのときだけ表示 */
const showNextSlot = computed(() => {
  const f = tab.ui?.state?.filter ?? {}
  const v = f.timeslot ?? 'auto'
  return v === 'auto'
})

/* ============================================================
 * Lists / Data mapping
 * ========================================================== */
const activeSlot = computed(() => unref(tab.activeSlot))

/* ====== “すべて” タブ ====== */
const isAll = computed(() => activeSlot.value == null)

const allActionable = computed(() =>
  isAll.value ? normalize(tab.allActionable) : []
)

const allDone = computed(() =>
  isAll.value ? normalize(tab.allDone) : []
)

/* ====== slot タブ (1〜4) ====== */
const slotActionable = computed(() =>
  isAll.value ? [] : normalize(tab.slotActionable)
)

const slotDone = computed(() =>
  isAll.value ? [] : normalize(tab.slotDone)
)

/* ====== anytime（slotタブのときだけ）====== */
const anytimeActionable = computed(() =>
  isAll.value ? [] : normalize(tab.anytimeActionable)
)

const anytimeDone = computed(() =>
  isAll.value ? [] : normalize(tab.anytimeDone)
)

/* ====== Next Slot ====== */
const nextSlot = computed(() => unref(tab.nextSlot) ?? null)
const nextSlotHabits = computed(() => normalize(tab.nextSlotHabits))

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

    <!-- Progress -->
    <TodayProgress v-if="tab.progress" :progress="tab.progress" />

    <TodayHeader />

    <!-- Top Pick -->
    <TodayTopPickCard
      v-if="tab.topPick && tab.topPick.h"
      :top-pick="tab.topPick"
      :timeslot-label="tab.timeslotLabel"
      :on-row-update="onRowUpdate"
    />

    <!-- ============================================================
         “すべて” タブ
         ============================================================ -->
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

    <!-- ============================================================
         “slot” タブ（朝/昼/夕/夜）
         ============================================================ -->
    <template v-else>
      <!-- slot actionable -->
      <section class="mt-6">
        <h2 class="text-lg font-semibold mb-2">
          {{ activeSlotLabel }}の習慣
        </h2>

        <TodayActionableSection
          :items="slotActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
          :is-focused="tab.isFocused"
          :toggle-focus="tab.toggleFocus"
        />
      </section>

      <!-- anytime actionable -->
      <TodayAnytimeSection
        v-if="anytimeActionable.length"
        :items="anytimeActionable"
        :on-row-update="onRowUpdate"
      />

      <!-- 次の時間帯 -->
      <TodayNextSlotSection
        v-if="showNextSlot && nextSlot"
        :next-slot="nextSlot"
        :items="nextSlotHabits"
        :on-row-update="onRowUpdate"
      />

      <!-- slot done -->
      <TodayDoneSection
        :show-completed="tab.ui.state.filter.showCompleted"
        :collapsed="tab.ui.state.collapse.done"
        :items="slotDone"
        :on-row-update="onRowUpdate"
        @toggle-collapse-done="tab.toggleCollapseDone"
      />

      <!-- anytime done -->
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