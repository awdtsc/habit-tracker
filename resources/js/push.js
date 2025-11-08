// resources/js/push.js
import axios from '@/axios'

// VAPID 公開鍵を Uint8Array に変換
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// =================================
// Service Worker を登録
// =================================
export async function registerServiceWorker() {
  console.log('[SW] registerServiceWorker() called')

  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] not supported')
    return null
  }

  const reg = await navigator.serviceWorker.register('/sw.js')
  console.log('[SW] Registered:', reg?.scope || reg)
  return reg
}

// =================================
// Push 購読を作成してサーバに送信（常に上書き保存）
// → 認証付きエンドポイント /api/push/subscribe 固定
// =================================
export async function setupPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }

  const permission = await Notification.requestPermission()
  console.log('[Notification] permission:', permission)
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()

  if (!sub) {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY is missing')
      return { ok: false, reason: 'no-vapid' }
    }
    console.log('[Push] Using VAPID key:', vapidPublicKey)

    const converted = urlBase64ToUint8Array(vapidPublicKey)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: converted,
    })
    console.log('[Push] New subscription created')
  } else {
    console.log('[Push] Existing subscription found')
  }

  // ---- 認証付きAPIへ常に保存（Sanctum Cookieを送る）----
  const json = sub.toJSON()
  json.contentEncoding = (PushManager.supportedContentEncodings || ['aes128gcm'])[0]

  try {
    const endpoint = '/api/push/subscribe'
    await axios.post(endpoint, json, { withCredentials: true })
    console.log('[Push] Subscription saved to server:', endpoint, json)
    return { ok: true }
  } catch (e) {
    console.error('[Push] Subscription save failed', e)
    return { ok: false, reason: 'server-error' }
  }
}

// ===============================
// ✅ コンソールから呼び出せるように公開
// ===============================
window.setupPush = setupPush
window.registerServiceWorker = registerServiceWorker