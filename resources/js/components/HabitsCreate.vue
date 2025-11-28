<!-- resources/js/components/HabitsCreate.vue -->
<template>
  <section class="max-w-xl mx-auto bg-white rounded shadow p-6">
    <h1 class="text-2xl font-semibold mb-4">新しい習慣を追加</h1>

    <form @submit.prevent="submit">
      <!-- タイトル -->
      <div class="mb-4">
        <label class="block font-bold mb-1">タイトル</label>
        <input v-model.trim="form.title" type="text" required class="w-full border rounded p-2" />
      </div>

      <!-- 説明 -->
      <div class="mb-4">
        <label class="block font-bold mb-1">説明</label>
        <textarea v-model.trim="form.description" rows="3" class="w-full border rounded p-2"></textarea>
      </div>

      <!-- （保留）通知時間：サーバ側では habit_times に寄せる想定。値は受けても無視してOK -->
      <div class="mb-4">
        <label class="block font-bold mb-1">通知時間（任意・将来対応）</label>
        <input v-model="form.notify_time" type="time" class="w-40 border rounded p-2" />
        <p class="mt-1 text-xs text-gray-500">
          ※ 今は保存しません（将来 Habit の時刻設定に統合予定）
        </p>
      </div>

      <!-- 頻度 -->
      <div class="mb-4">
        <label class="block font-bold mb-2">頻度</label>
        <div class="grid grid-cols-2 gap-3">
          <label class="inline-flex items-center gap-2">
            <input type="radio" value="daily" v-model="form.frequency_type" />毎日
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" value="weekdays" v-model="form.frequency_type" />平日
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" value="weekends" v-model="form.frequency_type" />週末
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" value="custom" v-model="form.frequency_type" />カスタム（曜日指定）
          </label>
          <label class="inline-flex items-center gap-2">
            <input type="radio" value="quota" v-model="form.frequency_type" />週の回数（自由）
          </label>
        </div>

        <!-- カスタム曜日 -->
        <div class="mt-3" :class="form.frequency_type==='custom' ? '' : 'opacity-50 pointer-events-none'">
          <div class="flex flex-wrap gap-3">
            <label v-for="(jp,num) in DOW_JP" :key="num" class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                :value="num"
                v-model="form.days_of_week"
                :disabled="form.frequency_type!=='custom'"
              />
              <span>{{ jp }}</span>
            </label>
          </div>
          <p class="mt-1 text-xs text-gray-500">※ カスタム選択時は曜日を指定</p>
        </div>

        <!-- 週クオータ -->
        <div class="mt-3" :class="form.frequency_type==='quota' ? '' : 'opacity-50 pointer-events-none'">
          <label class="block font-bold mb-1">週の目標回数</label>
          <input
            v-model.number="form.weekly_quota"
            :disabled="form.frequency_type!=='quota'"
            type="number" min="1" max="7" step="1"
            class="w-28 border rounded p-2"
          />
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
          <input v-model.trim="form.category" type="text" class="w-full border rounded p-2" />
        </div>
        <div class="sm:col-span-2">
          <label class="block font-bold mb-1">カラー（任意 / 例: #22c55e）</label>
          <input v-model.trim="form.color_tag" type="text" class="w-full border rounded p-2" />
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="px-4 py-2 rounded border" @click="goIndex">戻る</button>
        <button type="submit" :disabled="submitting" class="bg-blue-600 text-white px-4 py-2 rounded">
          <span v-if="submitting">送信中...</span>
          <span v-else>登録</span>
        </button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const submitting = ref(false)

const DOW_JP = {1:'月',2:'火',3:'水',4:'木',5:'金',6:'土',7:'日'}

const form = reactive({
  title: '', description: '',
  notify_time: '',              // 将来対応用
  frequency_type: 'daily',
  days_of_week: [],             // custom のときのみ使用（数値配列）
  weekly_quota: 3,              // quota のときのみ使用
  start_date: '', end_date: '', no_end: true,
  time_slot: 'anytime',
  evaluation_type: 'simple',
  category: '', color_tag: '',
})

function normalizePayload() {
  // v-model は文字列で入る可能性があるので数値化
  const days = Array.isArray(form.days_of_week)
    ? form.days_of_week.map(n => Number(n)).filter(n => n >= 1 && n <= 7)
    : []

  const payload = {
    title: form.title?.trim(),
    description: form.description?.trim() || null,
    frequency_type: form.frequency_type,
    days_of_week: form.frequency_type === 'custom' ? days : null,
    weekly_quota: form.frequency_type === 'quota' ? Number(form.weekly_quota || 0) : null,
    start_date: form.start_date || null,
    end_date: form.no_end ? null : (form.end_date || null),
    time_slot: form.time_slot,                 // API側で 0..4 に変換
    evaluation_type: form.evaluation_type,
    category: form.category?.trim() || null,
    color_tag: form.color_tag?.trim() || null,
    notify_time: form.notify_time || null,
  }

  // quota の weekly_quota が不正なら null
  if (payload.frequency_type !== 'quota') payload.weekly_quota = null

  return payload
}

function goIndex() {
  // 現在のルート名に合わせる
  router.push({ name: 'habits.index' })
}

async function submit() {
  const payload = normalizePayload()
  submitting.value = true
  try {
    await axios.post('/api/habits', payload)
    // 成功したら一覧へ
    goIndex()
  } catch (e) {
    console.error('[HabitCreate] create failed', e?.response?.data || e)
    alert('登録に失敗しました。入力内容とサーバのエラーログを確認してください。')
  } finally {
    submitting.value = false
  }
}
</script>
