<template>
  <div
    class="cell"
    :class="{
      planned: isPlanned,
      done: isDone,
      future: isFuture,
      empty: !isPlanned,
    }"
    @click="onClick"
  >
    <!-- 状態によって表示を変える -->
    <template v-if="!isPlanned">
      <span class="dot inactive">・</span>
    </template>

    <template v-else-if="isFuture">
      <span class="dot future-dot">・</span>
    </template>

    <template v-else-if="isDone">
      <span class="dot done-dot">●</span>
    </template>

    <template v-else>
      <span class="dot active">○</span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  habit: Object,
  date: String,
  isPlanned: Boolean,
  log: Object,
  isFuture: Boolean,
})

const emit = defineEmits(['toggle'])

const isDone = computed(() => {
  return props.log && props.log.status === 'done'
})

function onClick() {
  if (!props.isPlanned || props.isFuture) return
  emit('toggle')
}
</script>

<style scoped>
.cell {
  width: 100%;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.dot {
  font-size: 18px;
  line-height: 1;
}

.inactive {
  color: #bbb;
}

.future-dot {
  color: #ddd;
}

.done-dot {
  color: #2ecc71;
  font-size: 20px;
}

.active {
  color: #888;
}

.future {
  cursor: default;
  opacity: 0.5;
}

.empty {
  cursor: default;
  opacity: 0.3;
}
</style>