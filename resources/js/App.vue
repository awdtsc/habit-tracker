<!-- resources/js/App.vue -->
<template>
  <div class="min-h-screen bg-slate-50">
    <!-- /login ではヘッダー非表示（未ログインでタブを押せないようにする） -->
    <header
      v-if="showHeader"
      class="sticky top-0 z-10 flex gap-4 items-center bg-white border-b px-4 py-3"
    >
      <RouterLink
        :to="{ name:'Today' }"
        class="text-blue-600 no-underline hover:no-underline"
        active-class="font-semibold underline"
      >
        今日
      </RouterLink>
      <RouterLink
        :to="{ name:'Weekly' }"
        class="text-blue-600 no-underline hover:no-underline"
        active-class="font-semibold underline"
      >
        週
      </RouterLink>
      <!-- 任意：新規作成をSPA遷移に統一したい場合は有効化
      <RouterLink
        :to="{ name:'habits.create' }"
        class="text-blue-600 no-underline hover:no-underline"
        active-class="font-semibold underline"
      >
        新規作成
      </RouterLink>
      -->
      <span class="ml-auto text-sm text-gray-500">Habit Tracker</span>
    </header>

    <!-- メイン -->
    <main class="p-4">
      <!-- meta.keepAlive が true のページだけキャッシュ -->
      <RouterView v-slot="{ Component, route }">
        <KeepAlive :include="keepAliveNames">
          <component :is="Component" :key="route.fullPath" />
        </KeepAlive>
      </RouterView>
    </main>

    <!-- 🌐 グローバル・リマインドモーダル（taskId ベース） -->
    <RemindActionModal
      v-model="showRemindModal"
      :task-id="selectedTaskId"
      @updated="handleUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import RemindActionModal from '@/components/RemindActionModal.vue'

/** /login のときはヘッダーを隠す */
const route = useRoute()
const showHeader = computed(() => route.name !== 'login')

/**
 * KeepAlive 対象はルート meta.keepAlive = true の name を取り込む想定。
 * 例）router 定義側で Today/Weekly に meta: { keepAlive: true } を付与。
 */
const keepAliveNames = computed(() => (window.__KEEP_ALIVE_NAMES__ ?? ['Today','Weekly']))

const showRemindModal = ref(false)
const selectedTaskId  = ref(null)

function openByTaskId(taskId) {
  const id = Number(taskId)
  if (Number.isNaN(id)) return
  selectedTaskId.value = id
  showRemindModal.value = true
}

function handleUpdated() {
  // 完了後の画面リフレッシュは各ページ側で実施
  showRemindModal.value = false
}

/** グローバルイベント（app.js などから） */
function onWindowOpen(e) {
  openByTaskId(e?.detail?.taskId)
}

/** Service Worker からのメッセージ */
function onSwMessage(e) {
  const data = e?.data || {}
  if (data.type === 'OPEN_REMIND_MODAL' && data.taskId != null) {
    openByTaskId(data.taskId)
  } else if (data.type === 'OPEN_MODAL' && data.habitId != null) {
    // 後方互換：habitId しか来ない場合のフォールバック（必要ならAPIで taskId を引く）
    console.warn('[App] Fallback OPEN_MODAL received (habitId only). Prefer task_id.')
  }
}

onMounted(() => {
  // 1) グローバルイベント購読（window.dispatchEvent(new CustomEvent('open-remind-modal',{detail:{taskId}}))）
  window.addEventListener('open-remind-modal', onWindowOpen)

  // 2) SW メッセージ（直接受信の保険）
  navigator.serviceWorker?.addEventListener('message', onSwMessage)

  // 3) URL フォールバック (?remindTask=123) をドレイン
  try {
    const url = new URL(location.href)
    const q = url.searchParams.get('remindTask')
    if (q) {
      openByTaskId(q)
      history.replaceState({}, '', location.pathname + location.hash)
    }
  } catch {}

  // 4) 取りこぼし防止キューをドレイン（マウント前に届いた分）
  const qbuf = window.__remindQueue
  if (Array.isArray(qbuf) && qbuf.length) {
    console.log('[App] drain remindQueue', qbuf)
    while (qbuf.length) {
      const id = Number(qbuf.shift())
      if (!Number.isNaN(id)) openByTaskId(id)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('open-remind-modal', onWindowOpen)
  navigator.serviceWorker?.removeEventListener?.('message', onSwMessage)
})
</script>