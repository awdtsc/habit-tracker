<!-- resources/js/App.vue -->
<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 flex gap-4 items-center bg-white border-b px-4 py-3">
      <RouterLink to="/dashboard/today" class="text-blue-600 hover:underline">今日</RouterLink>
      <RouterLink to="/dashboard/week"  class="text-blue-600 hover:underline">週</RouterLink>
      <span class="ml-auto text-sm text-gray-500">Habit Tracker</span>
    </header>

    <main class="p-4">
      <!-- 画面切替しても状態を保持したいので KeepAlive を使用 -->
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
// ここは空でOK
</script>