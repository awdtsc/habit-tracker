<!-- resources/js/pages/Login.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <div class="w-full max-w-sm bg-white shadow rounded-xl p-6">
      <h1 class="text-xl font-semibold mb-4">ログイン</h1>

      <form @submit.prevent="onSubmit" class="space-y-4" novalidate>
        <!-- Email -->
        <div>
          <label for="email" class="text-sm text-gray-700">メールアドレス</label>
          <input
            id="email"
            name="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full border rounded px-3 py-2"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'login-error' : undefined"
          />
        </div>

        <!-- Password -->
        <div>
          <label for="password" class="text-sm text-gray-700">パスワード</label>
          <input
            id="password"
            name="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="mt-1 w-full border rounded px-3 py-2"
            :aria-invalid="!!error"
            :aria-describedby="error ? 'login-error' : undefined"
          />
        </div>

        <!-- Remember me （任意）-->
        <div class="flex items-center gap-2">
          <input id="remember" name="remember" type="checkbox" v-model="remember" class="h-4 w-4" />
          <label for="remember" class="text-sm text-gray-700">ログイン状態を保持する</label>
        </div>

        <button
          :disabled="loading"
          class="w-full rounded bg-blue-600 text-white py-2 disabled:opacity-60"
        >
          {{ loading ? '送信中...' : 'ログイン' }}
        </button>
      </form>

      <p
        v-if="error"
        id="login-error"
        class="text-sm text-red-600 mt-3"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../features/auth/api'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const remember = ref(false) // 使うなら /login 側で remember=true を扱う
const loading = ref(false)
const error = ref('')

function resolveRedirect () {
  const r = route.query.redirect
  if (typeof r === 'string' && r.startsWith('/')) return r
  return { name: 'Today' }
}

async function onSubmit () {
  loading.value = true
  error.value = ''
  try {
    await login({ email: email.value, password: password.value })
    await router.replace(resolveRedirect())
  } catch (e) {
    error.value = e?.response?.data?.message || 'ログインに失敗しました'
  } finally {
    loading.value = false
  }
}
</script>