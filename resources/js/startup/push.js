// resources/js/startup/push.js

import axios from 'axios'

/**
 * registerSwAndPush
 *
 * フロー:
 *   (1) Service Worker 登録
 *   (2) Push Manager → subscription 取得 or 新規作成
 *   (3) API /api/push-subscriptions に保存
 *
 * onLogin が true の場合:
 *   - ログイン画面では Push は実行しない（不要 & 401 回避）
 */
export async function registerSwAndPush(onLogin = false) {
  try {
    if (onLogin) {
      console.log('[PUSH] skip on login screen')
      return
    }

    // -----------------------------
    // 1) Service Worker の登録
    // -----------------------------
    if (!('serviceWorker' in navigator)) {
      console.warn('[PUSH] SW not supported')
      return
    }

    const reg = await navigator.serviceWorker.register('/sw.js')
    console.log('[PUSH] SW registered:', reg)

    // SW 待機（controller が付くまで）
    if (!navigator.serviceWorker.controller) {
      console.log('[PUSH] waiting controller…')
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // -----------------------------
    // 2) Push API の有無確認
    // -----------------------------
    if (!('PushManager' in window)) {
      console.warn('[PUSH] PushManager not supported')
      return
    }

    // -----------------------------
    // 3) VAPID 公開鍵取得
    // -----------------------------
    const r = await axios.get('/api/push/vapid-public-key')
    const vapidKey = r.data.publicKey
    if (!vapidKey) {
      console.warn('[PUSH] No VAPID key from backend')
      return
    }

    const convertedKey = urlBase64ToUint8Array(vapidKey)

    // -----------------------------
    // 4) 既存 subscription 取得
    // -----------------------------
    let sub = await reg.pushManager.getSubscription()

    if (!sub) {
      // -----------------------------
      // 5) 新規 subscription 作成
      // -----------------------------
      console.log('[PUSH] creating new subscription…')
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      })
    }

    if (!sub) {
      console.error('[PUSH] failed to obtain subscription')
      return
    }

    console.log('[PUSH] subscription:', sub)

    // -----------------------------
    // 6) DB に保存
    // -----------------------------
    await saveSubscription(sub)
    console.log('[PUSH] subscription saved')

  } catch (err) {
    console.error('[PUSH] error:', err)
  }
}

/**
 * Subscription をバックエンドに保存
 */
async function saveSubscription(sub) {
  return axios.post('/api/push-subscriptions', {
    endpoint: sub.endpoint,
    keys: sub.toJSON().keys
  })
}

/**
 * VAPID の base64 → UInt8Array 変換
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) {
    arr[i] = raw.charCodeAt(i)
  }
  return arr
}