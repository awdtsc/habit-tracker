<script setup>
import { computed, onMounted } from 'vue'
import { useHabitBoard } from '@/stores/useHabitBoard'

const {
  state,        // { habits, checks, loading, ... }
  todayISO,     // 'YYYY-MM-DD'
  fetchBoard,   // /api/weekly-board 取得
} = useHabitBoard()

const key = (hid, iso) => `${hid}|${iso}`
const isCheckedToday = (hid) => !!state.checks[key(hid, todayISO)]

const FT_LABEL = { daily:'毎日', weekdays:'平日', weekends:'週末', custom:'カスタム' }
const DOW_JP = {1:'月',2:'火',3:'水',4:'木',5:'金',6:'土',7:'日'}
const SLOT_LABEL = { morning:'朝', noon:'昼', evening:'夕', night:'夜', anytime:'いつでも' }

onMounted(fetchBoard)

// 編集・削除のURLは Blade 側から data 属性で受け取る
const root = document.getElementById('habits-index-root')
const baseUrl = root?.dataset?.habitsBase || '/habits'
const csrf = document.querySelector('meta[name="csrf-token"]')?.content || ''

function editUrl(id){ return `${baseUrl}/${id}/edit` }
function deleteHabit(id){
  if (!confirm('本当に削除しますか？')) return
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = `${baseUrl}/${id}`
  form.innerHTML = `
    <input type="hidden" name="_token" value="${csrf}">
    <input type="hidden" name="_method" value="DELETE">
  `
  document.body.appendChild(form)
  form.submit()
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-4">
    <div v-if="state.loading" class="text-center text-gray-500 py-10">読み込み中...</div>

    <div v-else-if="state.habits.length === 0" class="text-gray-600">
      まだ習慣が登録されていません。
    </div>

    <div v-else class="space-y-4">
      <div v-for="h in state.habits" :key="h.id" class="rounded-lg bg-white p-4 shadow ring-1 ring-gray-100">
        <h4 class="mb-2 flex items-center gap-2 text-xl font-bold text-gray-900">
          <span v-if="h.color_tag" class="inline-block h-3 w-3 rounded-full" :style="{backgroundColor: h.color_tag}"></span>
          {{ h.title }}
        </h4>

        <p v-if="h.description" class="mb-2 text-gray-700">{{ h.description }}</p>

        <div class="mt-1 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <div>
            <span class="font-medium text-gray-700">頻度:</span>
            <span>
              {{ FT_LABEL[h.frequency_type] ?? h.frequency_type }}
              <template v-if="h.frequency_type === 'custom' && Array.isArray(h.days_of_week)">
                （{{ h.days_of_week.map(n => DOW_JP[Number(n)] ?? n).join('・') }}）
              </template>
            </span>
          </div>

          <div><span class="font-medium text-gray-700">開始日:</span> {{ h.start_date || '' }}</div>

          <div>
            <span class="font-medium text-gray-700">終了日:</span>
            <span v-if="!h.end_date">なし（ずっと）</span>
            <span v-else>{{ h.end_date }}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700">今日の状態:</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
              :class="isCheckedToday(h.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
            >
              {{ isCheckedToday(h.id) ? '達成済み' : '未チェック' }}
            </span>
          </div>

          <div v-if="h.time_slot && h.time_slot !== 'anytime'">
            <span class="font-medium text-gray-700">時間帯:</span>
            <span>{{ SLOT_LABEL[h.time_slot] ?? h.time_slot }}</span>
          </div>

          <div v-if="h.category">
            <span class="font-medium text-gray-700">カテゴリ:</span>
            <span>{{ h.category }}</span>
          </div>
        </div>

        <div class="mt-3 flex gap-3">
          <a :href="editUrl(h.id)" class="text-blue-600 hover:underline">編集</a>
          <button class="text-red-600 hover:underline" @click="deleteHabit(h.id)">削除</button>
        </div>
      </div>

      <div class="mt-6 text-right">
        <a :href="`${baseUrl}/create`" class="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          ＋ 新しく習慣を追加
        </a>
      </div>
    </div>
  </div>
</template>