<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import { computed, unref, onMounted } from 'vue'

import TodayHeader from '@/components/today/TodayHeader.vue'
import TodayTopPickCard from '@/components/today/TodayTopPickCard.vue'
import TodayActionableSection from '@/components/today/TodayActionableSection.vue'
import TodayAnytimeSection from '@/components/today/TodayAnytimeSection.vue'
import TodayNextSlotSection from '@/components/today/TodayNextSlotSection.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import TodayDoneSection from '@/components/today/TodayDoneSection.vue'

import { useAuthStore } from '@/stores/auth'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import { useTodayState } from '@/composables/useTodayState'


/* ============================================================
 * Stores
 * ========================================================== */
const core   = useTodayState()
const auth   = useAuthStore()
const weekly = useWeeklyBoard()

/* debug */
if (typeof window !== 'undefined') {
  window.__today = core
  window.__weekly = weekly
}


/* ============================================================
 * Lifecycle
 * ========================================================== */
onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.fetchToday()
  }
})


/* ============================================================
 * Helper
 * ========================================================== */
const normalize = (raw) => {
  const v = unref(raw)
  return Array.isArray(v) ? v : []
}

const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }


/* ============================================================
 * Slot UI State（v2：数値スロットに完全統一）
 * ========================================================== */
const activeSlot = computed(() => {
  const t = core.ui.state.filter?.timeslot ?? 99  // 初期はALL
  if (t === 99) return null
  return Number(t)
})

const isAll = computed(() => activeSlot.value == null)

const activeSlotLabel = computed(() => {
  const s = activeSlot.value
  return s == null ? 'すべて' : (SLOT_LABEL[s] ?? '—')
})

const showNextSlot = computed(() =>
  core.ui.state.filter.timeslot === 99 ||
  core.ui.state.filter.timeslot === 'auto'
)


/* ============================================================
 * Lists（VM に完全統一）
 * ========================================================== */
const allActionable = computed(() =>
  isAll.value ? normalize(core.actionable) : []
)

const allDone = computed(() =>
  isAll.value ? normalize(core.done) : []
)

const slotActionable = computed(() => {
  if (isAll.value) return []
  const s = activeSlot.value
  return normalize(core.bySlot?.[s]?.filter(v => v.log?.status !== 'done'))
})

const slotDone = computed(() => {
  if (isAll.value) return []
  const s = activeSlot.value
  return normalize(core.bySlot?.[s]?.filter(v => v.log?.status === 'done'))
})

/* anytimeはスロット0に分類（v2仕様） */
const anytimeActionable = computed(() => {
  if (!isAll.value) return []
  return normalize(core.bySlot?.[0]?.filter(v => v.log?.status !== 'done'))
})

const anytimeDone = computed(() => {
  if (!isAll.value) return []
  return normalize(core.bySlot?.[0]?.filter(v => v.log?.status === 'done'))
})


/* next slot (v2 では整数) */
const nextSlot = computed(() => Number(core.nextSlot ?? 0))

const nextSlotHabits = computed(() => {
  if (!nextSlot.value) return []
  return normalize(core.bySlot?.[nextSlot.value])
})


/* ============================================================
 * Events
 * ========================================================== */
function onRowUpdate(habit, payload = {}) {
  if (!habit) return
  core.toggle({
    id: habit.id,
    status: payload.status,
    value: payload.value,
    rating: payload.rating,
  })
}

function goDetail(id) {
  const href = `/habits/${id}`
  if (window?.$router) window.$router.push(href)
  else location.assign(href)
}
</script>


<template>
  <div class="p-4 md:p-6 space-y-6">

    <!-- Header -->
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">今日</h1>
        <p class="text-sm text-gray-500">{{ core.todayYmd }}</p>
      </div>
    </header>

    <!-- Progress -->
    <TodayProgress :progress="core.progress" />

    <!-- Filters -->
    <TodayHeader />

    <!-- Top Pick -->
    <TodayTopPickCard
      v-if="core.topPick && core.topPick.h"
      :top-pick="core.topPick"
      :on-row-update="onRowUpdate"
    />


    <!-- ========================================================
     * すべて（ALL）
     * ====================================================== -->
    <template v-if="isAll">

      <section class="mt-6">
        <h2 class="text-lg font-semibold mb-2">すべて（未完了）</h2>
        <TodayActionableSection
          :items="allActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
          :is-focused="core.isFocused"
          :toggle-focus="core.toggleFocus"
        />
      </section>

      <!-- anytime -->
      <TodayAnytimeSection
        v-if="anytimeActionable.length"
        :items="anytimeActionable"
        :on-row-update="onRowUpdate"
      />

      <TodayDoneSection
        :show-completed="true"
        :collapsed="core.ui.state.collapse.done"
        :items="allDone"
        :on-row-update="onRowUpdate"
        @toggle-collapse-done="core.toggleCollapseDone"
      />
    </template>


    <!-- ========================================================
     * スロット別（朝/昼/夕/夜）
     * ====================================================== -->
    <template v-else>
      <section class="mt-6">
        <h2 class="text-lg font-semibold mb-2">{{ activeSlotLabel }}の習慣</h2>
        <TodayActionableSection
          :items="slotActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
          :is-focused="core.isFocused"
          :toggle-focus="core.toggleFocus"
        />
      </section>

      <!-- Next slot -->
      <TodayNextSlotSection
        v-if="showNextSlot && nextSlot"
        :next-slot="nextSlot"
        :items="nextSlotHabits"
        :on-row-update="onRowUpdate"
      />

      <!-- Done items -->
      <TodayDoneSection
        :show-completed="core.ui.state.filter.showCompleted"
        :collapsed="core.ui.state.collapse.done"
        :items="slotDone"
        :on-row-update="onRowUpdate"
        @toggle-collapse-done="core.toggleCollapseDone"
      />

      <!-- Anytime done (slot view でも常に表示) -->
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