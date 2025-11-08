<template>
  <div :style="{ height: `${height}px` }">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onBeforeUnmount, onActivated, watch, nextTick } from 'vue'
import { Chart } from 'chart.js/auto'

const props = defineProps({
  labels: { type: Array,  default: () => [] },
  values: { type: Array,  default: () => [] },
  height: { type: Number, default: 260 },
})

const canvasEl = ref(null)
const chart = shallowRef(null)

/* ---- getter ---- */
const getLabels = () => Array.isArray(props.labels) ? [...props.labels] : []
const getValues = () => (Array.isArray(props.values) ? props.values : []).map(v => Number(v) || 0)

/* ---- Chart生成 ---- */
function ensureChart() {
  if (chart.value) return chart.value
  chart.value = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      labels: getLabels(),
      datasets: [{
        label: '今週の達成率(%)',
        data: getValues(),
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } },
        x: { ticks: { autoSkip: false } },
      },
      plugins: {
        legend: { display: true },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y ?? 0}%` } },
      },
      elements: { line: { spanGaps: true } },
    },
  })
  return chart.value
}

/* ---- ラベル数が変わる場合は再生成 ---- */
function recreateIfShapeChanged(nextLabelsLen) {
  const c = chart.value
  if (!c) return
  if ((c.data.labels?.length ?? 0) !== nextLabelsLen) {
    c.destroy()
    chart.value = null
    ensureChart()
  }
}

/* ---- データ更新 ---- */
async function applyDataAndUpdate() {
  const nextLabels = getLabels()
  const nextValues = getValues()

  // ラベル数が変わる場合は再生成（Chart.js が稀に詰まる対策）
  recreateIfShapeChanged(nextLabels.length)

  const c = ensureChart()
  c.data.labels = nextLabels
  c.data.datasets[0].data = nextValues

  await nextTick()
  c.update()
}

/* ---- ライフサイクル ---- */
onMounted(() => { ensureChart(); applyDataAndUpdate() })
onActivated(() => { chart.value?.update() })
onBeforeUnmount(() => { chart.value?.destroy(); chart.value = null })

/* ---- watch ---- */
// ★ shallowRef対策: 個別 watch & deep オプション付き
watch(() => props.values, applyDataAndUpdate, { deep: true })
watch(() => props.labels, applyDataAndUpdate, { deep: true })

/* ---- 外部から手動で強制更新したい時用 ---- */
defineExpose({ forceUpdate: () => chart.value?.update() })
</script>