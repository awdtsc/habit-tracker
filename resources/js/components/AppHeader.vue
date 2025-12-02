<!-- resources/js/components/AppHeader.vue -->
<template>
  <header class="border-b bg-white">
    <div class="mx-auto max-w-6xl px-4 h-12 flex items-center gap-4">
      <RouterLink to="/" class="font-semibold text-gray-900">Habit</RouterLink>
      <nav class="ml-auto flex items-center gap-2 text-sm">
        <RouterLink :to="{ name:'Today' }"   class="px-3 py-1.5 rounded hover:bg-gray-100" active-class="bg-gray-900 text-white">Today</RouterLink>
        <RouterLink :to="{ name:'Weekly' }"  class="px-3 py-1.5 rounded hover:bg-gray-100" active-class="bg-gray-900 text-white">Weekly</RouterLink>
        <RouterLink :to="{ name:'Habits' }"  class="px-3 py-1.5 rounded hover:bg-gray-100" active-class="bg-gray-900 text-white">Habits</RouterLink>
        <!-- 新規作成（NGだった a を RouterLink/ router.push に） -->
        <RouterLink :to="{ name:'HabitCreate' }" class="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">新規作成</RouterLink>
        <!-- もしくはボタン版 -->
        <!-- <button class="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700" @click="$router.push({ name:'HabitCreate' })">新規作成</button> -->
      </nav>
    </div>
  </header>
</template>
<script setup>
/* RouterLink はグローバル登録済みなら import 不要 */
</script>