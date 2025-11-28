<!-- resources/js/components/tabs/TodayTab.vue -->
<script setup>
import { ref, computed, onMounted, provide } from 'vue'

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
 * ⚡ ちらつき防止
 * -------------------------------------------------------- */
const ready = ref(false)

/* ----------------------------------------------------------
 * mount 時のタブ復元
 * -------------------------------------------------------- */
function restoreTab() {
  const last = sessionStorage.getItem('today:lastTab')

  if (!last || last === 'auto') {
    core.enableAuto()
    return
  }

  core.setTab(last)
}

onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()

  if (!core.loaded.value) {
    await core.load()
  }

  restoreTab()
  ready.value = true
})

/* ---------------------------------------------------------- */
const mode = computed(() => {
  if (core.autoMode.value) return 'auto'
  if (core.selectedSlot.value === null) return 'all'
  return 'slot'
})

const activeSlot = computed(() => core.activeSlot.value)

/* ----------------------------------------------------------
 * 並び順：priority（高い順）
 * -------------------------------------------------------- */
const sortByPriority = list =>
  [...(list ?? [])].sort((a, b) => {
    const pa = a.h.priority ?? 0
    const pb = b.h.priority ?? 0
    return pb - pa
  })

/* ----------------------------------------------------------
 * 全体リスト
 * -------------------------------------------------------- */
const allActionable = computed(() =>
  sortByPriority(core.actionable.value)
)

const allDone = computed(() =>
  sortByPriority(core.done.value)
)

/* ----------------------------------------------------------
 * Slot lists
 * -------------------------------------------------------- */
const slotLists = computed(() => core.slots.value ?? {})

const slotActionable = computed(() =>
  sortByPriority(slotLists.value?.[activeSlot.value]?.actionable ?? [])
)

const slotDone = computed(() =>
  sortByPriority(slotLists.value?.[activeSlot.value]?.done ?? [])
)

/* ----------------------------------------------------------
 * NextSlot
 * -------------------------------------------------------- */
const nextSlot = computed(() => core.nextSlot.value)
const nextSlotItems = computed(() =>
  sortByPriority(core.nextSlotItems.value ?? [])
)

/* ----------------------------------------------------------
 * topPick: すべてタブの最優先
 * -------------------------------------------------------- */
const topPick = computed(() => {
  const arr = allActionable.value
  return arr.length ? arr[0] : null
})

const topPickSlotLabel = computed(() =>
  slotLabelFor(topPick.value?.h?.time_slot)
)

/* ----------------------------------------------------------
 * progress（表示中のリストだけで計算）
 * -------------------------------------------------------- */
const progress = computed(() => {
  let list = []

  if (mode.value === 'all') {
    list = [...allActionable.value, ...allDone.value]
  } else {
    const rows = slotLists.value?.[activeSlot.value]
    if (rows) {
      list = [...slotActionable.value, ...slotDone.value]
    }
  }

  const total = list.length
  const completed = list.filter(i => i.log?.status === 'done').length

  return {
    total,
    completed,
    rate: total === 0 ? 0 : completed / total,
  }
})

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

/* ---------------------------------------------------------- */
function goDetail(id) {
  const href = `/habits/${id}`
  if (window?.$router) window.$router.push(href)
  else location.assign(href)
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
  <div v-if="ready" class="p-4 md:p-6 space-y-8">

    <header>
      <h1 class="text-2xl font-semibold">今日</h1>
      <p class="text-sm text-gray-500">{{ core.todayYmd }}</p>
    </header>

    <TodayProgress :progress="progress" />
    <TodayHeader :change-tab="changeTab" />

    <!-- ✔ すべてタブのときだけ表示 -->
    <TodayTopPickCard
      v-if="mode === 'all' && topPick"
      :top-pick="topPick"
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

      <div v-if="ui.state.filter.showCompleted">
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

      <div v-if="ui.state.filter.showCompleted">
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

      <div v-if="ui.state.filter.showCompleted">
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