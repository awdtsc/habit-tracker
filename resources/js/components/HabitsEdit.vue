<!-- resources/js/components/HabitsEdit.vue -->
<template>
  <section class="max-w-xl mx-auto bg-white rounded shadow p-6">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">習慣を編集</h1>
      <button class="px-3 py-2 border rounded" @click="goBack" :disabled="submitting">戻る</button>
    </header>

    <!-- 読み込み中 -->
    <div v-if="loading" class="text-center text-gray-500 py-10">読み込み中...</div>

    <!-- 本体 -->
    <form v-else @submit.prevent="submit">
      <!-- タイトル -->
      <div class="mb-4">
        <label class="block font-bold mb-1">タイトル</label>
        <input v-model.trim="form.title" type="text" required class="w-full border rounded p-2" />
      </div>

      <!-- 説明 -->
      <div class="mb-4">
        <label class="block font-bold mb-1">説明</label>
        <textarea v-model="form.description" rows="3" class="w-full border rounded p-2"></textarea>
      </div>

      <!-- 通知時間 -->
      <div class="mb-4">
        <label class="block font-bold mb-1">通知時間（任意）</label>
        <input v-model="form.notify_time" type="time" class="w-40 border rounded p-2" />
        <p class="mt-1 text-xs text-gray-500">※ 指定するとこの習慣に紐づく通知時間が登録されます</p>
      </div>

      <!-- 頻度 -->
      <div class="mb-4">
        <label class="block font-bold mb-2">頻度</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="inline-flex items-center gap-2"><input type="radio" value="daily"    v-model="form.frequency_type" />毎日</label>
          <label class="inline-flex items-center gap-2"><input type="radio" value="weekdays" v-model="form.frequency_type" />平日</label>
          <label class="inline-flex items-center gap-2"><input type="radio" value="weekends" v-model="form.frequency_type" />週末</label>
          <label class="inline-flex items-center gap-2"><input type="radio" value="custom"   v-model="form.frequency_type" />カスタム（曜日指定）</label>
          <label class="inline-flex items-center gap-2"><input type="radio" value="quota"    v-model="form.frequency_type" />週の回数（自由）</label>
        </div>

        <!-- カスタム曜日 -->
        <div class="mt-3" :class="form.frequency_type==='custom' ? '' : 'opacity-50 pointer-events-none'">
          <div class="flex flex-wrap gap-3">
            <label v-for="(jp,num) in DOW_JP" :key="num" class="inline-flex items-center gap-2">
              <input type="checkbox" :value="Number(num)" v-model="form.days_of_week" />
              <span>{{ jp }}</span>
            </label>
          </div>
          <p class="mt-1 text-xs text-gray-500">※ カスタム選択時は曜日を指定</p>
        </div>

        <!-- 週クオータ -->
        <div class="mt-3" :class="form.frequency_type==='quota' ? '' : 'opacity-50 pointer-events-none'">
          <label class="block font-bold mb-1">週の目標回数</label>
          <input v-model.number="form.weekly_quota" type="number" min="1" max="7" step="1" class="w-28 border rounded p-2" />
          <p class="mt-1 text-xs text-gray-500">例: 3 → 「今週3回できれば達成」。曜日は自由</p>
        </div>
      </div>

      <!-- 期間 -->
      <div class="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="block font-bold mb-1">開始日</label>
          <input v-model="form.start_date" type="date" class="w-full border rounded p-2" />
        </div>
        <div>
          <label class="block font-bold mb-1">終了日</label>
          <div class="flex items-center gap-3">
            <input v-model="form.end_date" :disabled="form.no_end" type="date" class="border rounded p-2" />
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="form.no_end" />
              <span>終了日なし（ずっと）</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 任意メタ -->
      <div class="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="block font-bold mb-1">時間帯（任意）</label>
          <select v-model="form.time_slot" class="w-full border rounded p-2">
            <option value="anytime">いつでも</option>
            <option value="morning">朝</option>
            <option value="noon">昼</option>
            <option value="evening">夕</option>
            <option value="night">夜</option>
          </select>
        </div>

        <div>
          <label class="block font-bold mb-1">評価方式</label>
          <select v-model="form.evaluation_type" class="w-full border rounded p-2" required>
            <option value="simple">単純評価（達成/未達成）</option>
            <option value="self">自己評価（点数やコメント付き）</option>
          </select>
          <p class="mt-1 text-xs text-gray-500">※ 自己評価は habit_logs.rating を使用</p>
        </div>

        <div>
          <label class="block font-bold mb-1">カテゴリ（任意）</label>
          <input v-model="form.category" type="text" class="w-full border rounded p-2" />
        </div>
        <div class="sm:col-span-2">
          <label class="block font-bold mb-1">カラー（任意 / 例: #22c55e）</label>
          <input v-model="form.color_tag" type="text" class="w-full border rounded p-2" />
        </div>
      </div>

      <!-- 操作 -->
      <div class="mt-6 flex items-center justify-between">
        <button type="button" class="text-red-600 hover:underline disabled:opacity-60" :disabled="submitting" @click="confirmDelete">
          削除
        </button>
        <div class="flex gap-3">
          <button type="button" class="px-4 py-2 rounded border" @click="goBack" :disabled="submitting">キャンセル</button>
          <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" :disabled="submitting">
            更新
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const DOW_JP = {1:'月',2:'火',3:'水',4:'木',5:'金',6:'土',7:'日'}

const loading = ref(true)
const submitting = ref(false)

const form = reactive({
  title: '',
  description: '',
  notify_time: '',
  frequency_type: 'daily',
  days_of_week: [],
  weekly_quota: 3,
  start_date: '',
  end_date: '',
  no_end: true,
  time_slot: 'anytime',
  evaluation_type: 'simple',
  category: '',
  color_tag: '',
})

const id = Number(route.params.id)

// ISO日付(YYYY-MM-DD)に丸めるヘルパ
function toISODate(val) {
  if (!val) return ''
  // 既に YYYY-MM-DD ならそのまま
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const d = new Date(val)
  if (isNaN(d)) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function load() {
  try {
    loading.value = true
    const { data } = await axios.get(`/api/habits/${id}`)
    const h = data?.habit || data // API形状に合わせて調整

    form.title = h.title || ''
    form.description = h.description || ''
    form.notify_time = h.notify_time ?? '' // "HH:MM" 期待

    form.frequency_type = h.frequency_type || 'daily'
    form.days_of_week = Array.isArray(h.days_of_week)
      ? h.days_of_week.map(n => Number(n))
      : []

    // 週クオータ（target_times.weekly 等を使用している場合に対応）
    if (typeof h.weekly_quota === 'number') {
      form.weekly_quota = h.weekly_quota
    } else if (h.target_times && h.target_times.weekly) {
      form.weekly_quota = Number(h.target_times.weekly) || 3
    }

    form.start_date = toISODate(h.start_date)
    form.end_date   = toISODate(h.end_date)
    form.no_end     = !h.end_date

    form.time_slot        = h.time_slot || 'anytime'
    form.evaluation_type  = h.evaluation_type || 'simple'
    form.category         = h.category || ''
    form.color_tag        = h.color_tag || ''
  } catch (e) {
    console.error('[HabitEdit] load failed', e?.response?.data || e)
    alert('データの取得に失敗しました。')
    goBack()
  } finally {
    loading.value = false
  }
}

async function submit() {
  try {
    submitting.value = true
    const payload = {
      ...form,
      end_date: form.no_end ? null : form.end_date,
    }
    await axios.put(`/api/habits/${id}`, payload)
    router.push({ name: 'Habits' })
  } catch (e) {
    console.error('[HabitEdit] update failed', e?.response?.data || e)
    alert('更新に失敗しました。入力内容をご確認ください。')
  } finally {
    submitting.value = false
  }
}

async function confirmDelete() {
  if (!confirm('本当に削除しますか？')) return
  try {
    submitting.value = true
    await axios.delete(`/api/habits/${id}`)
    router.push({ name: 'Habits' })
  } catch (e) {
    console.error('[HabitEdit] delete failed', e?.response?.data || e)
    alert('削除に失敗しました。')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push({ name: 'Habits' })
}

onMounted(load)
</script>
