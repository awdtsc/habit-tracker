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


// ==========================================================
// Today State v3
// ==========================================================
const core = useTodayState()
provide('today', core)

if (typeof window !== 'undefined') window.__today = core


// ==========================================================
// Auth + WeeklyBoard + Today
// ==========================================================
const auth = useAuthStore()
const weekly = useWeeklyBoard()

onMounted(async () => {
  await auth.waitUntilReady()
  if (!auth.isAuthenticated) return

  await weekly.fetchWeeklyBoard()
  if (!core.loaded.value) await core.load()
})


// ==========================================================
// Slot label helper
// ==========================================================
function slotLabelFor(s) {
  return {
    1: '朝',
    2: '昼',
    3: '夕',
    4: '夜',
  }[s] ?? ''
}


// ==========================================================
// Mode（auto / slot / all）
// ==========================================================
const mode = computed(() => {
  if (core.autoMode.value) return 'auto'
  if (core.selectedSlot.value === null) return 'all'
  return 'slot'
})

const activeSlot = computed(() => core.activeSlot.value)


// ==========================================================
// Lists
// ==========================================================

// slot → {actionable, done}
const slotLists = computed(() => core.slots.value ?? {})

const slotActionable = computed(() => {
  return slotLists.value[activeSlot.value]?.actionable ?? []
})

const slotDone = computed(() => {
  return slotLists.value[activeSlot.value]?.done ?? []
})

const allActionable = computed(() => core.actionable.value ?? [])
const allDone       = computed(() => core.done.value ?? [])

// next slot
const nextSlot = computed(() => core.nextSlot.value)
const nextSlotItems = computed(() => {
  if (!nextSlot.value) return []
  return slotLists.value[nextSlot.value]?.actionable ?? []
})


// ==========================================================
// Events
// ==========================================================
function onRowUpdate(habit, payload = {}) {
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

// expose for template
</script>


<template>
  <div class="p-4 md:p-6 space-y-6">

    <!-- Header -->
    <header>
      <h1 class="text-2xl font-semibold">今日</h1>
      <p class="text-sm text-gray-500">{{ core.todayYmd }}</p>
    </header>

    <!-- Progress -->
    <TodayProgress :progress="core.progress" />

    <!-- Header Buttons (auto / slot / all) -->
    <TodayHeader />

    <!-- TopPick -->
    <TodayTopPickCard
      v-if="core.topPick"
      :top-pick="core.topPick"
      :timeslot-label="slotLabelFor(core.activeSlot)"
      :on-row-update="onRowUpdate"
    />


    <!-- ===================================================== -->
    <!--  ALL モード（時間帯無視）                           -->
    <!-- ===================================================== -->
    <section v-if="mode === 'all'" class="space-y-8 mt-6">

      <!-- すべての習慣（未完了） -->
      <div>
        <h2 class="text-lg font-semibold mb-2">すべて（未完了）</h2>
        <TodayActionableSection
          :items="allActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
        />
      </div>

      <!-- 完了 -->
      <TodayDoneSection
        :items="allDone"
        :show-completed="true"
        :collapsed="false"
        :on-row-update="onRowUpdate"
      />

    </section>


    <!-- ===================================================== -->
    <!-- SLOT モード                                           -->
    <!-- ===================================================== -->
    <section v-else-if="mode === 'slot'" class="space-y-8 mt-6">

      <!-- 時間帯 -->
      <div>
        <h2 class="text-lg font-semibold mb-2">この時間帯（未完了）</h2>
        <TodayActionableSection
          :items="slotActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
        />
      </div>

      <!-- 完了 -->
      <TodayDoneSection
        :items="slotDone"
        :show-completed="true"
        :collapsed="false"
        :on-row-update="onRowUpdate"
      />

      <!-- 次の時間帯 -->
      <TodayNextSlotSection
        v-if="nextSlot && nextSlotItems.length"
        :next-slot="nextSlot"
        :items="nextSlotItems"
        :on-row-update="onRowUpdate"
      />
    </section>


    <!-- ===================================================== -->
    <!-- AUTO モード（現在スロット自動判定）                  -->
    <!-- ===================================================== -->
    <section v-else class="space-y-8 mt-6">

      <!-- 今の時間帯 -->
      <div>
        <h2 class="text-lg font-semibold mb-2">この時間帯（自動）</h2>
        <TodayActionableSection
          :items="slotActionable"
          :on-row-update="onRowUpdate"
          :go-detail="goDetail"
        />
      </div>

      <!-- 完了 -->
      <TodayDoneSection
        :items="slotDone"
        :show-completed="true"
        :collapsed="false"
        :on-row-update="onRowUpdate"
      />

      <!-- 次の時間帯 -->
      <TodayNextSlotSection
        v-if="nextSlot && nextSlotItems.length"
        :next-slot="nextSlot"
        :items="nextSlotItems"
        :on-row-update="onRowUpdate"
      />
    </section>

  </div>
</template>
