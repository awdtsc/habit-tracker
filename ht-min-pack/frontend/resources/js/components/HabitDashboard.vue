<!-- resources/js/components/HabitDashboard.vue -->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import HabitWeeklyBoard from './HabitWeeklyBoard.vue'
import TodayTab from './tabs/TodayTab.vue'
import MonthlyCalendar from './tabs/MonthlyCalendar.vue'
import ReviewTab from './tabs/ReviewTab.vue'
import RemindActionModal from './RemindActionModal.vue'

// --------------------
// Tabs（ローカル切替方式のまま）
// --------------------
const tabs = [
  { id: 'today',   label: '今日' },
  { id: 'weekly',  label: '週間' },
  { id: 'monthly', label: '月間' },
  { id: 'review',  label: '振り返り' },
]
const active = ref('today')
function setTab(id) {
  active.value = id
  history.replaceState(null, '', `#${id}`)
}

// 即時反映キー
const todayKey  = ref(0)
const weeklyKey = ref(0)
let _toggleHandler

// --------------------
// Remind モーダル
// --------------------
const showRemindModal = ref(false)
const selectedTaskId  = ref(null)

function handleOpenRemindModal(e) {
  const id = Number(e.detail?.taskId)
  if (!Number.isNaN(id)) openByTaskId(id)
}
function openByTaskId(id) {
  selectedTaskId.value = id
  showRemindModal.value = true
}
function handleRemindUpdated() {
  // 完了後などに今日タブを再マウントして即反映
  todayKey.value++
  active.value = 'today'
}

// --------------------
// Vue Router 統一（生リンク禁止）
// --------------------
const router = useRouter()
function goCreate(evt) {
  evt?.preventDefault?.()
  router.push({ name: 'HabitCreate' }) // '/habits/new' → 名前付きルートへ正規化
}

onMounted(() => {
  // ハッシュでアクティブタブ復元
  const h = location.hash.slice(1)
  if (tabs.some(t => t.id === h)) active.value = h

  // 週タブの再取得トリガ
  _toggleHandler = () => { weeklyKey.value++ }
  window.addEventListener('habit:toggle', _toggleHandler)

  // SW→app.js→イベントバスの通知を受け取ってモーダルを開く
  const bus = window.__remindBus
  if (bus) {
    bus.addEventListener('open-remind-modal', handleOpenRemindModal)
  }

  // URLフォールバック (?remindTask=123)
  const q = new URL(location.href).searchParams.get('remindTask')
  if (q) {
    openByTaskId(Number(q))
    // 以降で毎回出ないようクエリ削除（履歴は保持）
    history.replaceState({}, '', location.pathname + location.hash)
  }

  // 受信キューをドレイン（マウント前の通知を拾う）
  const qbuf = window.__remindQueue
  if (Array.isArray(qbuf) && qbuf.length) {
    console.log('[UI] drain remindQueue', qbuf)
    while (qbuf.length) {
      const id = Number(qbuf.shift())
      if (!Number.isNaN(id)) openByTaskId(id)
    }
  }
})

onUnmounted(() => {
  if (_toggleHandler) window.removeEventListener('habit:toggle', _toggleHandler)
  window.__remindBus?.removeEventListener('open-remind-modal', handleOpenRemindModal)
})
</script>

<template>
  <section class="mx-auto max-w-6xl p-6">
    <!-- Tabs -->
    <nav class="flex gap-2 border-b mb-4" role="tablist" aria-label="Habit views">
      <button
        v-for="t in tabs"
        :key="t.id"
        @click="setTab(t.id)"
        class="px-3 py-2 rounded-t-md text-sm font-medium"
        :class="active===t.id ? 'bg-white border-x border-t border-gray-200 -mb-px' : 'text-gray-600 hover:text-gray-900'">
        {{ t.label }}
      </button>
    </nav>

    <!-- Panels -->
    <keep-alive>
      <!-- 🔄 完了後の即時反映用に :key を付与 -->
      <TodayTab v-if="active==='today'" :key="todayKey" />
      <HabitWeeklyBoard v-else-if="active==='weekly'" :key="weeklyKey" />
      <MonthlyCalendar v-else-if="active==='monthly'" />
      <ReviewTab v-else />
    </keep-alive>

    <!-- 右下固定のグローバルFAB（Vue Routerで遷移） -->
    <!-- a[href] は使わず、ボタン + router.push に統一 -->
    <button
      @click="goCreate"
      class="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 text-white shadow-lg px-4 py-3 hover:bg-blue-700"
      aria-label="新しい習慣を追加">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
      </svg>
      <span class="hidden sm:inline">習慣を追加</span>
    </button>

    <!-- ★ リマインド操作モーダル -->
    <RemindActionModal
      v-model="showRemindModal"
      :task-id="selectedTaskId"
      @updated="handleRemindUpdated"
    />
  </section>
</template>