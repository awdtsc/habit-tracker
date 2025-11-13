<!-- resources/js/components/RemindActionModal.vue -->
<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'

const authAxios = axios.create({
  baseURL: axios.defaults.baseURL,
  withCredentials: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
})

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  taskId:     { type: Number,  default: null },
})
const emit = defineEmits(['update:modelValue','updated'])

const open = computed({
  get: () => props.modelValue,
  set: v  => emit('update:modelValue', v)
})

const busy        = ref(false)
const err         = ref('')
const habitLogId  = ref(null)
const taskLoading = ref(false)

// ★ カスタム：時間＋分（上限24h=1440分）
const customHour  = ref(0)   // 0〜24
const customMin   = ref(30)  // 0〜59
const customErr   = ref('')

function close() { emit('update:modelValue', false) }

async function ensureAuth() {
  try { await authAxios.get('/api/user'); return } catch {}
  await authAxios.get('/sanctum/csrf-cookie')
  await authAxios.post('/login', { email: 'nkmt4664@gmail.com', password: 'awdtsc4664' })
  await authAxios.get('/api/user')
}

async function fetchTaskDetail(id) {
  if (!id) return
  taskLoading.value = true
  err.value = ''
  try {
    await ensureAuth()
    const { data } = await authAxios.get(`/api/remind-tasks/${id}`)
    habitLogId.value = data.habit_log_id ?? null
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'unknown'
    err.value = `タスク情報を取得できません: ${msg}`
    habitLogId.value = null
  } finally {
    taskLoading.value = false
  }
}

watch(() => [open.value, props.taskId], ([isOpen, id]) => {
  if (isOpen && id) fetchTaskDetail(id)
}, { immediate: true })

async function markDone() {
  if (!props.taskId) return
  busy.value = true
  err.value  = ''
  try {
    await ensureAuth()
    const { data } = await authAxios.post(`/api/reminders/${props.taskId}/done`, null)
    emit('updated', data)
    window.postMessage({ type: 'HABIT_LOG_UPDATED', payload: data }, '*')
    open.value = false
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'unknown'
    err.value = `完了にできませんでした: ${msg}`
  } finally {
    busy.value = false
  }
}

// プリセット
async function onSnoozePreset(preset) {
  if (!habitLogId.value) return
  busy.value = true
  err.value  = ''
  try {
    await ensureAuth()
    const payload = { habit_log_id: Number(habitLogId.value), parent_task_id: props.taskId, preset }
    const { data } = await authAxios.post('/api/remind-tasks', payload)
    emit('updated', data)
    window.postMessage({ type: 'REMIND_SCHEDULED', payload: data }, '*')
    open.value = false
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'unknown'
    err.value = `リマインド予約に失敗しました: ${msg}`
  } finally {
    busy.value = false
  }
}

// ★ カスタム（時間＋分→分に換算）
async function onSnoozeCustom() {
  if (!habitLogId.value) return
  customErr.value = ''
  const h = Number(customHour.value)
  const m = Number(customMin.value)

  // 入力ガード
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
    customErr.value = '時刻の形式が不正です'
    return
  }
  const total = h * 60 + m
  if (total < 1 || total > 1440) {
    customErr.value = '1分以上24時間（1440分）以内で設定してください'
    return
  }

  busy.value = true
  err.value  = ''
  try {
    await ensureAuth()
    const payload = {
      habit_log_id: Number(habitLogId.value),
      parent_task_id: props.taskId,
      preset: 'custom',
      minutes: total
    }
    const { data } = await authAxios.post('/api/remind-tasks', payload)
    emit('updated', data)
    window.postMessage({ type: 'REMIND_SCHEDULED', payload: data }, '*')
    open.value = false
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'unknown'
    err.value = `リマインド予約に失敗しました: ${msg}`
  } finally {
    busy.value = false
  }
}

// ★ キャンセル（pending → canceled）
async function cancelReminder() {
  if (!props.taskId) return
  busy.value = true
  err.value  = ''
  try {
    await ensureAuth()
    const { data } = await authAxios.post(`/api/reminders/${props.taskId}/cancel`, null)
    emit('updated', data)
    window.postMessage({ type: 'REMIND_CANCELED', payload: data }, '*')
    open.value = false
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || 'unknown'
    err.value = `キャンセルに失敗しました: ${msg}`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="dialog" aria-modal="true" aria-label="リマインダー操作"
  >
    <div class="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <h2 class="text-lg font-semibold mb-2">リマインド</h2>
      <p class="text-sm text-gray-600 mb-4">
        タスクID:
        <span class="font-mono">{{ taskId ?? '不明' }}</span>
        <span v-if="taskLoading" class="ml-2 text-xs text-gray-400">読み込み中…</span>
      </p>

      <div class="space-y-3">
        <!-- ✅ 完了 -->
        <button
          class="w-full rounded-xl px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          :disabled="busy || !taskId"
          @click="markDone">
          <span v-if="busy">処理中…</span>
          <span v-else>✅ 完了</span>
        </button>

        <!-- プリセット（0時間5分/10分、1時間0分） -->
        <div class="grid grid-cols-3 gap-2">
          <button
            class="rounded-xl px-4 py-3 bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-60"
            :disabled="busy || taskLoading || !habitLogId"
            @click="onSnoozePreset('5m')">
            0時間5分
          </button>
          <button
            class="rounded-xl px-4 py-3 bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-60"
            :disabled="busy || taskLoading || !habitLogId"
            @click="onSnoozePreset('10m')">
            0時間10分
          </button>
          <button
            class="rounded-xl px-4 py-3 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
            :disabled="busy || taskLoading || !habitLogId"
            @click="onSnoozePreset('1h')">
            1時間0分
          </button>
        </div>

        <!-- ★ カスタム（時間＋分） -->
        <div class="rounded-xl border p-3">
          <label class="block text-sm text-gray-700 mb-2">カスタム</label>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <input
                type="number" min="0" max="24" step="1"
                v-model.number="customHour"
                class="w-24 rounded border px-2 py-1"
                :disabled="busy || taskLoading || !habitLogId"
              />
              <span class="text-sm text-gray-600">時間</span>
            </div>
            <div class="flex items-center gap-1">
              <input
                type="number" min="0" max="59" step="1"
                v-model.number="customMin"
                class="w-24 rounded border px-2 py-1"
                :disabled="busy || taskLoading || !habitLogId"
              />
              <span class="text-sm text-gray-600">分</span>
            </div>
            <button
              class="ml-auto rounded-xl px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              :disabled="busy || taskLoading || !habitLogId"
              @click="onSnoozeCustom">
              予約
            </button>
          </div>
          <p v-if="customErr" class="mt-2 text-xs text-rose-600">{{ customErr }}</p>
          <p class="mt-1 text-xs text-gray-500">
            ※ 合計は 1分 以上 24時間（1440分）以下にしてください
          </p>
        </div>

        <!-- 🔕 通知をやめる（今回だけ） -->
        <button
          class="w-full rounded-xl px-4 py-3 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-60"
          :disabled="busy || !taskId"
          @click="cancelReminder">
          🔕 通知をやめる（今回だけ）
        </button>
      </div>

      <p v-if="err" class="mt-3 text-sm text-rose-600">{{ err }}</p>

      <button class="mt-4 text-sm text-gray-500" @click="close">閉じる</button>
    </div>
  </div>
</template>