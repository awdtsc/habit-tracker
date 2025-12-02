<template>
  <div class="flex items-center gap-1" role="group" aria-label="自己評価(0-4)">
    <button
      v-for="i in 5" :key="i"
      :aria-pressed="modelValue === (i-1)"
      class="h-6 w-6 rounded-full border flex items-center justify-center text-xs"
      :class="modelValue >= (i-1) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
      @click="$emit('update:modelValue', i-1)"
    >{{ i-1 }}</button>
  </div>
</template>

<script setup>
defineProps({ modelValue: { type: Number, default: 0 } })
defineEmits(['update:modelValue'])
</script>