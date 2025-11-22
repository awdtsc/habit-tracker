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
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import { useTodayState } from '@/composables/useTodayState'

/* ----------------------------------------------------------
 * Stores
 * -------------------------------------------------------- */
const core   = useTodayState()
const auth   = useAuthStore()
const weekly = useWeeklyBoard()

if (typeof window !== 'undefined') window.__today = core

/* ----------------------------------------------------------
 * Lifecycle
 * -------------------------------------------------------- */
onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.load()
  }
})

/* ----------------------------------------------------------
 * Helpers
 * -------------------------------------------------------- */
const normalize = v => Array.isArray(unref(v)) ? unref(v) : []

const SLOT_LABEL = { 1: '朝', 2: '昼', 3: '夕', 4: '夜' }

/* ----------------------------------------------------------
 * Slot filter（v3 では core.ui は削除 → ALL のみ最小構成）
 * -------------------------------------------------------- */
const activeSlot = computed(() => null)
const isAll = computed(() => true)
const activeSlotLabel = computed(() => 'すべて')
const showNextSlot = computed(() => true)

/* ----------------------------------------------------------
 * Lists (core の v3 API だけ使う)
 * -------------------------------------------------------- */
const allActionable = computed(() => normalize(core.actionable))
const allDone       = computed(() => normalize(core.done))

const anytimeActionable = computed(() =>
  normalize(core.bySlot?.[0]?.filter(v => v.log?.status !== 'done'))
)

const anytimeDone = computed(() =>
  normalize(core.bySlot?.[0]?.filter(v => v.log?.status === 'done'))
)

const nextSlot = computed(() => Number(core.nextSlot ?? 0))
const nextSlotHabits = computed(() => normalize(core.bySlot?.[nextSlot.value]))

/* ----------------------------------------------------------
 * Events
 * -------------------------------------------------------- */
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

    <!-- ======================================================
     * ALL MODE（最小構成）
     * ==================================================== -->
    <section class="mt-6">
      <h2 class="text-lg font-semibold mb-2">すべて（未完了）</h2>
      <TodayActionableSection
        :items="allActionable"
        :on-row-update="onRowUpdate"
        :go-detail="goDetail"
      />
    </section>

    <!-- Anytime -->
    <TodayAnytimeSection
      v-if="anytimeActionable.length"
      :items="anytimeActionable"
      :on-row-update="onRowUpdate"
    />

    <!-- Done -->
    <TodayDoneSection
      :show-completed="true"
      :collapsed="false"
      :items="allDone"
      :on-row-update="onRowUpdate"
    />

    <!-- Next Slot -->
    <TodayNextSlotSection
      v-if="showNextSlot && nextSlot"
      :next-slot="nextSlot"
      :items="nextSlotHabits"
      :on-row-update="onRowUpdate"
    />
  </div>
</template>