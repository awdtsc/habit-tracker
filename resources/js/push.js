// resources/js/push.js
import axios from '@/axios'

// ---- helpers ----
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function uint8ToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
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

  // /sw.js（public直下）を登録
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  console.log('[SW] Registered:', reg?.scope || reg)
  // ready を返す（activeになるのを待つ）
  return await navigator.serviceWorker.ready
}

// =================================
// Push 購読を作成してサーバへ保存（常に再購読して鍵を確実に更新）
// 保存先: 認証付き /api/push/subscribe
// =================================
export async function setupPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' }
    }

    const permission = await Notification.requestPermission()
    console.log('[Notification] permission:', permission)
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' }
    }

    const reg = await navigator.serviceWorker.ready

    // 既存購読は一旦解除（鍵が変わらないままになる事故を防ぐ）
    const old = await reg.pushManager.getSubscription()
    if (old) {
      try { await old.unsubscribe() } catch {}
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.error('[Push] VITE_VAPID_PUBLIC_KEY is missing')
      return { ok: false, reason: 'no-vapid' }
    }

    // 新規購読（鍵つき）
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    console.log('[Push] New subscription created')

    // --- 鍵を取り出して base64 へ（DBは p256dh / auth の平文base64を想定）---
    const p256dh = uint8ToBase64(sub.getKey('p256dh'))
    const auth   = uint8ToBase64(sub.getKey('auth'))

    // content-encoding は aes128gcm 既定（ブラウザ依存だが実質これ）
    const content_encoding =
      (navigator?.PushManager?.supportedContentEncodings?.[0]) || 'aes128gcm'

    // ---- サーバ保存（Sanctum Cookieを送る）----
    // ※ API 側は endpoint / p256dh / auth / content_encoding を受けて保存する実装に
    await axios.post(
      '/api/push/subscribe',
      {
        endpoint: sub.endpoint,
        p256dh,
        auth,
        content_encoding,
        user_agent: navigator.userAgent,
      },
      { withCredentials: true },
    )

    console.log('[Push] Subscription saved to server')
    return { ok: true }
  } catch (e) {
    console.error('[Push] setupPush failed', e)
    return { ok: false, reason: e?.message || String(e) }
  }
}

// ===============================
// ✅ コンソールから呼び出せるように公開
// ===============================
window.setupPush = setupPush
window.registerServiceWorker = registerServiceWorker