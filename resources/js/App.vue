<!-- resources/js/App.vue -->
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- グローバルヘッダー（今日 / 今週 タブ） -->
    <MainHeader />

    <!-- 各ページの中身 -->
    <main class="mx-auto max-w-6xl py-6 px-4">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router'
import MainHeader from '@/components/MainHeader.vue'
</script>