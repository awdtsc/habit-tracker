// resources/js/api.js
import axios from './bootstrap'

// --- CSRF ---
export async function fetchCsrf() {
  await axios.get('/sanctum/csrf-cookie', { withCredentials: true })
}

// --- 認証状態 ---
export async function getAuthState() {
  const { data } = await axios.get('/api/auth/state', {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  return data
}

export async function getCurrentUser() {
  const { data } = await axios.get('/api/user', {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  return data
}

// --- ログイン / ログアウト ---
export async function login({ email, password }) {
  await fetchCsrf()
  await axios.post('/login', { email, password }, {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  return await getAuthState()
}
export async function logout() {
  await axios.post('/logout', {}, {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  return { ok: true }
}

// --- 今日タブ ---
export async function getToday() {
  const { data } = await axios.get('/api/today', {
    headers: { Accept: 'application/json' },
    withCredentials: true,
  })
  return data
}

// まとめて参照したい場合用
export default { fetchCsrf, getAuthState, getCurrentUser, login, logout, getToday }