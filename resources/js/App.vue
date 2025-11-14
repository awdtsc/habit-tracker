<!-- resources/js/App.vue -->
<template>
  <!-- デバッグ用：まずは RouterView だけをそのまま表示 -->
  <div class="min-h-screen bg-gray-100">
    <RouterView />
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
</script>