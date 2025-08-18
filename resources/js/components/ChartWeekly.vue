<template>
  <!-- 親に高さを持たせるとレイアウトが安定します -->
  <div :style="{height: `${height}px`}">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Chart } from 'chart.js/auto'

const props = defineProps({
  labels: { type: Array,   default: () => [] },   // ["08/11", ...]
  values: { type: Array,   default: () => [] },   // [0, 100, ...]
  height: { type: Number,  default: 260 },        // キャンバスの高さ（px）
})

const canvasEl = ref(null)
let chart = null

function ensureChart() {
  if (chart) return chart
  chart = new Chart(canvasEl.value, {
    type: 'line',
    data: {
      labels: props.labels,
      datasets: [{
        label: '今週の達成率(%)',
        data: props.values.map(v => Number(v) || 0),
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,           // 親divの高さに追従
      animation: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { stepSize: 20 } },
        x: { ticks: { autoSkip: false } },
      },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: { label: ctx => `${ctx.parsed.y ?? 0}%` }
        }
      },
      elements: { line: { spanGaps: true } },
    },
  })
  return chart
}

onMounted(() => {
  ensureChart()
})

/**
 * propsが変わったら必ず反映
 * deep: false にして配列参照の変化をトリガーに（値が同一でも新配列なら更新）
 */
watch(
  () => [props.labels, props.values],
  () => {
    const c = ensureChart()
    c.data.labels = props.labels ?? []
    c.data.datasets[0].data = (props.values ?? []).map(v => Number(v) || 0)
    c.update()
  }
)

onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
})
</script>