<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import TodayHeader from '@/components/today/TodayHeader.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import TodayTopPickCard from '@/components/today/TodayTopPickCard.vue'
import TodayActionableSection from '@/components/today/TodayActionableSection.vue'
import TodayAnytimeSection from '@/components/today/TodayAnytimeSection.vue'
import TodayNextSlotSection from '@/components/today/TodayNextSlotSection.vue'
import TodayDoneSection from '@/components/today/TodayDoneSection.vue'

import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTodayState } from '@/composables/useTodayState'
import { useTodayTab } from '@/composables/useTodayTab'

/* ---------------------------
 * 1. コアストア（唯一の useTodayState）
 * ------------------------- */
const core = useTodayState()
const auth = useAuthStore()

// デバッグ用：今の core を見たいときに
if (typeof window !== 'undefined') {
  window.__today = core
}

/* ---------------------------
 * 2. UIロジック（core を渡す）
 * ------------------------- */
const {
  ui,
  loading,
  habits,
  plannedHabits,
  resolvedTimeslot,
  resolvedTimeslotLabel,
  timeslotLabel,
  topPick,
  actionableOnly,
  anytimeDisplay,
  done,
  nextSlotHabits,
  nextSlot,
  isFocused,
  toggleFocus,
  toggleCollapseDone,
  getTodayLog,
  onUpdate,
  ymd,
} = useTodayTab(core)

/* ---------------------------
 * 3. 初期ロード（認証 → 初回 fetch）
 * ------------------------- */
onMounted(async () => {
  console.log('[Today] mounted')

  await auth.waitUntilReady()
  console.log('[Today] auth.ready =', auth.ready)

  if (!auth.isAuthenticated) {
    console.warn('[Today] not authenticated → skip')
    return
  }

  if (!core.loaded.value) {
    console.log('[Today] fetch triggered')
    await core.fetchToday()
    console.log('[Today] fetch complete: loaded =', core.loaded.value)
  }
})

/* ---------------------------
 * 4. Row 更新
 * ------------------------- */
function onRowUpdate(habit, payload = {}) {
  onUpdate({
    id: habit.id,
    status: payload.status,
    value: payload.value,
    rating: payload.rating,
  })
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
</script>

<template>
  <div class="p-4 md:p-6 space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">今日</h1>
        <p class="text-sm text-gray-500">
          {{ ymd(new Date()) }}
        </p>
      </div>
    </header>

    <TodayProgress
      :habits="plannedHabits"
      :get-today-log="getTodayLog"
      :timeslot="resolvedTimeslot"
    />

    <TodayHeader />

    <TodayTopPickCard
      v-if="resolvedTimeslot === 'all' && topPick"
      :top-pick="topPick"
      :timeslot-label="timeslotLabel"
      :on-row-update="onRowUpdate"
    />

    <div class="text-sm text-gray-600">
      対象: {{ resolvedTimeslotLabel }} ／
      完了{{ ui.state.filter.showCompleted ? '含む' : '隠す' }} ／
      {{ ui.state.filter.limit === 1 ? '1件だけ' : '全件' }}
    </div>

    <TodayActionableSection
      :loading="loading"
      :items="actionableOnly"
      :is-focused="isFocused"
      :toggle-focus="toggleFocus"
      :go-detail="goDetail"
      :on-row-update="onRowUpdate"
    />

    <TodayAnytimeSection
      :items="anytimeDisplay"
      :on-row-update="onRowUpdate"
    />

    <TodayNextSlotSection
      :next-slot="nextSlot"
      :items="nextSlotHabits"
      :on-row-update="onRowUpdate"
    />

    <TodayDoneSection
      :show-completed="ui.state.filter.showCompleted"
      :collapsed="ui.state.collapse.done"
      :items="done"
      :on-row-update="onRowUpdate"
      @toggle-collapse-done="toggleCollapseDone"
    />
  </div>
</template>