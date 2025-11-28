<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import { computed, onMounted, provide } from 'vue'

import TodayHeader from '@/components/today/TodayHeader.vue'
import TodayProgress from '@/components/today/TodayProgress.vue'
import TodayActionableSection from '@/components/today/TodayActionableSection.vue'
import TodayDoneSection from '@/components/today/TodayDoneSection.vue'
import TodayNextSlotSection from '@/components/today/TodayNextSlotSection.vue'
import TodayTopPickCard from '@/components/today/TodayTopPickCard.vue'

import { useAuthStore } from '@/stores/auth'
import { useWeeklyBoard } from '@/stores/useWeeklyBoard'
import { useTodayState } from '@/composables/useTodayState'
import { slotLabelFor } from '@/domain/timeutil'
import { useUiState } from '@/stores/uiState'

/* ----------------------------------------------------------
 * TodayState
 * -------------------------------------------------------- */
const core = useTodayState()
provide('today', core)

if (typeof window !== 'undefined') window.__today = core

const auth   = useAuthStore()
const weekly = useWeeklyBoard()
const ui     = useUiState()

/* ----------------------------------------------------------
 * 恩赦：明示 tab → スロット番号 to tabName
 * -------------------------------------------------------- */
function slotNumToTabName(num) {
  const map = {
    1: 'morning',
    2: 'noon',
    3: 'evening',
    4: 'night',
  }
  return map[num] ?? 'all'
}

/* ----------------------------------------------------------
 * mount 時のタブ復元（ハイブリッド方式）
 * -------------------------------------------------------- */
onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()
  if (!core.loaded.value) await core.load()

  // Week → Today 遷移時：直前タブの復元
  const lastTab = sessionStorage.getItem('today:lastTab')

  if (!lastTab) {
    // 初回アクセス → auto
    core.enableAuto()
    return
  }

  // auto は復元しない（危険）
  if (lastTab === 'auto') {
    core.enableAuto()
    return
  }

  // 明示 tab の復元
  core.setTab(lastTab)
})

/* ----------------------------------------------------------
 * タブ名の確定（UI 用）
 * -------------------------------------------------------- */
const mode = computed(() => {
  if (core.autoMode.value) return 'auto'
  if (core.selectedSlot.value === null) return 'all'
  return 'slot'
})

/* ----------------------------------------------------------
 * 状態反映
 * -------------------------------------------------------- */
const activeSlot        = computed(() => core.activeSlot.value)
const topPickSlotLabel  = computed(() =>
  slotLabelFor(core.topPick.value?.h?.time_slot)
)

const limitOne      = computed(() => ui.state.filter.limit === 1)
const showCompleted = computed(() => ui.state.filter.showCompleted !== false)

/* ----------------------------------------------------------
 * lists
 * -------------------------------------------------------- */
const slotLists = computed(() => core.slots.value ?? {})

const applyLimit = (list = []) =>
  limitOne.value ? list.slice(0, 1) : list

const slotActionable = computed(() =>
  applyLimit(slotLists.value?.[activeSlot.value]?.actionable ?? [])
)

const slotDone = computed(() =>
  slotLists.value?.[activeSlot.value]?.done ?? []
)

const allActionable = computed(() =>
  applyLimit(core.actionable.value ?? [])
)

const allDone = computed(() =>
  core.done.value ?? []
)

const nextSlot      = computed(() => core.nextSlot.value)
const nextSlotItems = computed(() => core.nextSlotItems.value ?? [])

/* ----------------------------------------------------------
 * Row 操作
 * -------------------------------------------------------- */
function onRowUpdate(habit, payload = {}) {
  core.toggle({
    id     : habit.id,
    status : payload.status,
    value  : payload.value,
    rating : payload.rating,
  })
}

/* ----------------------------------------------------------
 * goDetail
 * -------------------------------------------------------- */
function goDetail(id) {
  const href = `/habits/${id}`
  if (window?.$router) {
    window.$router.push(href)
  } else {
    location.assign(href)
  }
}

/* ----------------------------------------------------------
 * タブ変更時はセッションに保存
 * -------------------------------------------------------- */
function changeTab(tabName) {
  core.setTab(tabName)
  sessionStorage.setItem('today:lastTab', tabName)
}
</script>

<template>
  <div class="p-4 md:p-6 space-y-8">

    <header>
      <h1 class="text-2xl font-semibold">今日</h1>
      <p class="text-sm text-gray-500">{{ core.todayYmd }}</p>
    </header>

    <TodayProgress :progress="core.progress" />

    <TodayHeader :change-tab="changeTab" />

    <TodayTopPickCard
      v-if="core.topPick"
      :top-pick="core.topPick"
      :timeslot-label="topPickSlotLabel"
      :onRowUpdate="onRowUpdate"
    />

    <!-- ALL -->
    <section v-if="mode === 'all'" class="space-y-10 mt-4">
      <div>
        <h2 class="text-lg font-semibold mb-3">すべて（未完了）</h2>
        <div class="bg-white shadow rounded-lg p-4">
          <TodayActionableSection
            :items="allActionable"
            :onRowUpdate="onRowUpdate"
            :goDetail="goDetail"
          />
        </div>
      </div>

      <div v-if="showCompleted">
        <TodayDoneSection
          :items="allDone"
          :showCompleted="true"
          :collapsed="false"
          :onRowUpdate="onRowUpdate"
        />
      </div>
    </section>

    <!-- SLOT -->
    <section v-else-if="mode === 'slot'" class="space-y-10 mt-4">
      <div>
        <h2 class="text-lg font-semibold mb-3">この時間帯（未完了）</h2>
        <div class="bg-white shadow rounded-lg p-4">
          <TodayActionableSection
            :items="slotActionable"
            :onRowUpdate="onRowUpdate"
            :goDetail="goDetail"
          />
        </div>
      </div>

      <div v-if="showCompleted">
        <TodayDoneSection
          :items="slotDone"
          :showCompleted="true"
          :collapsed="false"
          :onRowUpdate="onRowUpdate"
        />
      </div>

      <TodayNextSlotSection
        v-if="nextSlot && nextSlotItems.length"
        :next-slot="nextSlot"
        :items="nextSlotItems"
        :onRowUpdate="onRowUpdate"
      />
    </section>

    <!-- AUTO -->
    <section v-else class="space-y-10 mt-4">
      <div>
        <h2 class="text-lg font-semibold mb-3">この時間帯（自動）</h2>
        <div class="bg-white shadow rounded-lg p-4">
          <TodayActionableSection
            :items="slotActionable"
            :onRowUpdate="onRowUpdate"
            :goDetail="goDetail"
          />
        </div>
      </div>

      <div v-if="showCompleted">
        <TodayDoneSection
          :items="slotDone"
          :showCompleted="true"
          :collapsed="false"
          :onRowUpdate="onRowUpdate"
        />
      </div>

      <TodayNextSlotSection
        v-if="nextSlot && nextSlotItems.length"
        :next-slot="nextSlot"
        :items="nextSlotItems"
        :onRowUpdate="onRowUpdate"
      />
    </section>

  </div>
</template>