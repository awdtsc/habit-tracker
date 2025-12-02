// resources/js/startup/remind.js

import axios from '@/axios'

/**
 * リマインド関連の全ての初期化
 * app.js 本体から呼び出す構成
 */
export function setupRemindSystem() {
  console.log('[REMIND] setupRemindSystem start')

  // グローバルイベントバス
  const bus = new EventTarget()
  window.__remindBus = bus
  window.__remindQueue = window.__remindQueue || []

  setupServiceWorkerMessageListener()
  setupQueryTrigger()
}

/**
 * Service Worker からのメッセージを受け取る
 * OPEN_REMIND_MODAL（新）と OPEN_MODAL（旧）をサポート
 */
function setupServiceWorkerMessageListener() {
  if (!navigator.serviceWorker) return

  navigator.serviceWorker.addEventListener('message', async (e) => {
    const data = e?.data || {}
    console.log('[REMIND] SW message =', data)

    try {
      // 新：taskId 直接
      if (data.type === 'OPEN_REMIND_MODAL' && data.taskId != null) {
        const taskId = Number(data.taskId)
        dispatchOpenModal(taskId)
        return
      }

      // 旧：habitId → API で pending task を解決
      if (data.type === 'OPEN_MODAL' && data.habitId != null) {
        const habitId = Number(data.habitId)
        await resolveHabitToTaskAndDispatch(habitId)
        return
      }
    } catch (err) {
      console.error('[REMIND] message handler error', err)
    }
  })
}

/**
 * habitId → 最後の pendingTask を探し → モーダルを開かせる
 */
async function resolveHabitToTaskAndDispatch(habitId) {
  try {
    const { data: res } = await axios.get('/api/remind-tasks/latest-by-habit', {
      params: { habit_id: habitId },
      withCredentials: true,
    })
    const taskId = res?.task?.id
    if (taskId) {
      dispatchOpenModal(taskId)
    } else {
      console.warn('[REMIND] No pending task for habit', habitId)
    }
  } catch (err) {
    console.error('[REMIND] resolveHabitToTask failed', err?.response?.data || err)
  }
}

/**
 * 実際の「モーダルを開く」トリガー
 */
function dispatchOpenModal(taskId) {
  console.log('[REMIND] dispatchOpenModal', taskId)

  window.__remindQueue.push(taskId)

  const ev = new CustomEvent('open-remind-modal', { detail: { taskId } })

  // 双方向通知：
  // - Vue app（component）向け
  // - window 直接（古い設計でリッスンしていた場所向け）
  window.__remindBus.dispatchEvent(ev)
  window.dispatchEvent(ev)
}

/**
 * URL の ?remindTask=123 を modal イベントに変換
 */
function setupQueryTrigger() {
  try {
    const url = new URL(location.href)
    const q = url.searchParams.get('remindTask')
    if (!q) return

    const taskId = Number(q)
    console.log('[REMIND] Query remindTask → dispatch', taskId)

    dispatchOpenModal(taskId)

    // クエリをURLから消す
    history.replaceState({}, '', location.pathname + location.hash)
  } catch (err) {
    console.warn('[REMIND] setupQueryTrigger failed', err)
  }
}