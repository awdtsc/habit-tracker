import { reactive, computed } from 'vue'

const state = reactive({
  items: [
    { id: 1, title: '水を飲む', done: false },
    { id: 2, title: '10分散歩', done: true },
    { id: 3, title: '日記を書く', done: false },
  ],
  saving: {},  // saving[id] === true/false
  errors: {},  // errors[id] === 'メッセージ'
})

const totalCount     = computed(() => state.items.length)
const completedCount = computed(() => state.items.filter(it => it.done).length)
const progress       = computed(() =>
  totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100)
)

export async function toggle(id) {
  const it = state.items.find(x => x.id === id)
  if (!it) return

  const prev = it.done
  it.done = !it.done

  state.saving[id] = true
  state.errors[id] = ''

  try {
    await new Promise(r => setTimeout(r, 200))
    // 失敗試験したい時:
    // if (Math.random() < 0.2) throw new Error('ネットワークエラー')
  } catch (e) {
    it.done = prev
    state.errors[id] = e.message || 'エラー'
  } finally {
    state.saving[id] = false
  }
}

export function useMiniBoard() {
  return { state, totalCount, completedCount, progress, toggle }
}