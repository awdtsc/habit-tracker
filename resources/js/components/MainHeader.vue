<!-- resources/js/components/MainHeader.vue -->
<template>
  <header class="border-b bg-white">
    <div class="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
      <!-- 左：今日 / 週 ナビ -->
      <nav class="flex items-center gap-4 text-base">
        <RouterLink
          to="/today"
          class="pb-1"
          :class="linkClass('Today')"
        >
          今日
        </RouterLink>

        <RouterLink
          to="/week"
          class="pb-1"
          :class="linkClass('Week')"
        >
          週
        </RouterLink>
      </nav>

      <!-- 右：アプリ名 -->
      <div class="text-sm text-gray-500">
        Habit Tracker
      </div>
    </div>
  </header>
</template>

<script setup>
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const linkClass = (name) => {
  const isActive = route.name === name
  return isActive
    ? 'text-blue-600 border-b-2 border-blue-500 font-semibold'
    : 'text-gray-500 hover:text-gray-800'
}
</script>