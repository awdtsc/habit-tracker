<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue'
import HabitWeeklyBoard from './HabitWeeklyBoard.vue'
import TodayTab from './tabs/TodayTab.vue'
import MonthlyCalendar from './tabs/MonthlyCalendar.vue'
import ReviewTab from './tabs/ReviewTab.vue'

const tabs = [
  { id: 'today',   label: '今日' },
  { id: 'weekly',  label: '週間' },
  { id: 'monthly', label: '月間' },
  { id: 'review',  label: '振り返り' },
]
const active = ref('today')
function setTab(id){ active.value = id; history.replaceState(null,'', `#${id}`) }
onMounted(() => { const h = location.hash.slice(1); if (tabs.some(t=>t.id===h)) active.value = h })

// ルーターがあればSPA遷移、なければ通常遷移（/habits/new にGET）
const { proxy } = getCurrentInstance()
function goCreate(evt){
  const r = proxy?.$router
  if (r?.push) { evt.preventDefault(); r.push('/habits/new') }
}
</script>

<template>
  <section class="mx-auto max-w-6xl p-6">
    <!-- Tabs -->
    <nav class="flex gap-2 border-b mb-4" role="tablist" aria-label="Habit views">
      <button v-for="t in tabs" :key="t.id" @click="setTab(t.id)"
              class="px-3 py-2 rounded-t-md text-sm font-medium"
              :class="active===t.id ? 'bg-white border-x border-t border-gray-200 -mb-px' : 'text-gray-600 hover:text-gray-900'">
        {{ t.label }}
      </button>
    </nav>

    <!-- Panels -->
    <keep-alive>
      <TodayTab v-if="active==='today'" />
      <HabitWeeklyBoard v-else-if="active==='weekly'" />
      <MonthlyCalendar v-else-if="active==='monthly'" />
      <ReviewTab v-else />
    </keep-alive>

    <!-- 右下固定のグローバルFAB（ルーター有無どちらでも動く） -->
    <a href="/habits/new" @click="goCreate"
       class="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 text-white shadow-lg px-4 py-3 hover:bg-blue-700"
       aria-label="新しい習慣を追加">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      <span class="hidden sm:inline">習慣を追加</span>
    </a>
  </section>
</template>