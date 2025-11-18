<!-- resources/js/components/WeeklyTagCell.vue -->
<template>
  <div class="cell-root">
    <!-- 予定なし：何も出さない（空スペースだけ） -->
    <div v-if="status === null" class="empty"></div>

    <!-- 予定あり：未完了（オレンジのバー） -->
    <button
      v-else-if="status === 'pending'"
      type="button"
      class="tag pending"
      :class="{ future: isFuture }"
      @click.stop="onClick"
    >
      <span class="bar"></span>
    </button>

    <!-- 予定あり：完了（グリーンのバー） -->
    <button
      v-else
      type="button"
      class="tag done"
      :class="{ future: isFuture }"
      @click.stop="onClick"
    >
      <span class="bar"></span>
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  // null | 'pending' | 'done'
  status: {
    type: String,
    default: null,
  },
  // いまのところ表示には使ってないけど、将来ツールチップ等で使えるように残しておく
  label: {
    type: String,
    default: '',
  },
  isFuture: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])

function onClick() {
  // 未来日は操作不可にしたい場合
  if (props.isFuture) return
  if (props.status === null) return
  emit('toggle')
}
</script>

<style scoped>
.cell-root {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px; /* 行の高さを揃える */
}

/* 空セル用のダミー要素（高さだけ確保） */
.empty {
  width: 100%;
  height: 24px;
}

/* ボタン共通 */
.tag {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

/* 見た目は細い横棒だけにする */
.bar {
  display: inline-block;
  width: 24px;
  height: 4px;
  border-radius: 999px;
}

/* 未完了 → オレンジ */
.pending .bar {
  background-color: #ff9800;
}

/* 完了 → グリーン */
.done .bar {
  background-color: #4caf50;
}

/* 未来日 → 半透明＆カーソルを無効っぽく */
.future {
  opacity: 0.35;
  cursor: default;
}
</style>
