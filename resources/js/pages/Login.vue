<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <div class="w-full max-w-sm bg-white shadow rounded-xl p-6">
      <h1 class="text-xl font-semibold mb-4">ログイン</h1>

      <form @submit.prevent="onSubmit" class="space-y-4" novalidate>
        <div>
          <label for="email" class="text-sm text-gray-700">メールアドレス</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label for="password" class="text-sm text-gray-700">パスワード</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="mt-1 w-full border rounded px-3 py-2"
          />
        </div>

        <button
          :disabled="loading"
          class="w-full rounded bg-blue-600 text-white py-2 disabled:opacity-60"
        >
          {{ loading ? '送信中...' : 'ログイン' }}
        </button>
      </form>

      <p v-if="error" class="text-sm text-red-600 mt-3">
        {{ error }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

function resolveRedirect() {
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/')) return r
  return { name: 'Today' }
}

async function onSubmit() {
  loading.value = true
  error.value = ''

  try {
    // Sanctum login → /api/user の本物フロー
    const user = await auth.login({
      email: email.value,
      password: password.value,
    })

    if (user && user.id) {
      return router.replace(resolveRedirect())
    } else {
      error.value = 'ログインに失敗しました'
    }
  } catch (e) {
    error.value = 'ログインに失敗しました'
    console.error('[Login]', e)
  } finally {
    loading.value = false
  }
}
</script>