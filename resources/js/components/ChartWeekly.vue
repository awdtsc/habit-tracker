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

const getLabels = () => Array.isArray(props.labels) ? [...props.labels] : []
const getValues = () => (Array.isArray(props.values) ? props.values : []).map(v => Number(v) || 0)

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

async function applyDataAndUpdate() {
  const c = ensureChart()
  c.data.labels = getLabels()
  c.data.datasets[0].data = getValues()
  await nextTick()
  c.update('none')
}

onMounted(() => { ensureChart(); applyDataAndUpdate() })
onActivated(() => { chart.value?.update('none') })

watch(() => [props.labels, props.values], () => { applyDataAndUpdate() }, { deep: false })

onBeforeUnmount(() => { chart.value?.destroy(); chart.value = null })

defineExpose({ forceUpdate: () => chart.value?.update('none') })
</script>