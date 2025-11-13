// public/sw.js
console.log('[SW] loaded');

/**
 * 通知を実際に表示する共通関数
 */
function showHabitNotification(data) {
  const title = data?.title || 'リマインド';

  const options = {
    body: data?.body || 'そろそろ習慣の時間です',
    icon: data?.icon || '/icons/icon-192x192.png',
    badge: data?.badge || '/icons/icon-72x72.png',
    tag: data?.tag || `habit-${Date.now()}`,
    requireInteraction: true,
    // サーバ側が data.data に本体を入れてくるパターンと、
    // data 直下に入れてくるパターンの両方に対応
    data: data && data.data ? data.data : data,
  };

  console.log('[SW] showNotification:', title, options);
  return self.registration.showNotification(title, options);
}

/**
 * push payload を安全にパースする
 * - JSONでもtextでもOK
 * - 失敗したら最低限の形にする
 */
async function parsePushEvent(event) {
  if (!event.data) {
    console.warn('[SW] push event without data');
    return {};
  }

  // まず text として読む（1回しか読めないのでここで取る）
  const text = await event.data.text();
  if (!text) {
    return {};
  }

  try {
    const json = JSON.parse(text);
    console.log('[SW] parsed JSON push data:', json);
    return json;
  } catch (e) {
    console.warn('[SW] push data is not JSON, use plain text', e);
    return { title: 'リマインド', body: text };
  }
}

// ---------- Push 受信 ----------
self.addEventListener('push', (event) => {
  console.log('[SW] push event fired');

  event.waitUntil(
    (async () => {
      const data = await parsePushEvent(event);
      try {
        await showHabitNotification(data);
        console.log('[SW] showNotification resolved');
      } catch (err) {
        console.error('[SW] showNotification failed:', err);
      }
    })()
  );
});

// ---------- メッセージ受信（テスト用） ----------
self.addEventListener('message', (event) => {
  console.log('[SW] message received', event.data);
  if (event.data?.type === 'SHOW_TEST_NOTIFICATION') {
    event.waitUntil(showHabitNotification(event.data.payload || {}));
  }
});

// ---------- 通知クリック（taskId / habitId をアプリへ渡す） ----------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const raw = event.notification?.data || {};
  // ★ 互換対応: taskId / task_id / remind_task_id のいずれでも受ける
  const taskIdRaw = raw.taskId ?? raw.task_id ?? raw.remind_task_id;
  const habitIdRaw = raw.habitId ?? raw.habit_id;

  const taskId = Number(taskIdRaw);
  const habitId = Number(habitIdRaw);
  const hasValidTask = Number.isFinite(taskId) && taskId > 0;
  const hasValidHabit = Number.isFinite(habitId) && habitId > 0;

  const baseUrl = raw.url || '/dashboard/today';
  const targetUrl = hasValidTask
    ? `${baseUrl}?remindTask=${encodeURIComponent(taskId)}`
    : hasValidHabit
      ? `${baseUrl}?pending=${encodeURIComponent(habitId)}`
      : baseUrl;

  console.log('[SW] notification clicked', {
    raw,
    taskIdRaw,
    habitIdRaw,
    taskId,
    habitId,
    hasValidTask,
    hasValidHabit,
    baseUrl,
    targetUrl,
  });

  event.waitUntil(
    (async () => {
      // 既存タブを探す
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });

      // 「このアプリっぽいURL」を優先して探す
      const sameOriginClient =
        allClients.find((c) => c.url.includes('/dashboard')) ||
        allClients.find((c) => c.url.includes('/habits')) ||
        allClients[0];

      if (sameOriginClient) {
        await sameOriginClient.focus();

        if (hasValidTask) {
          sameOriginClient.postMessage({ type: 'OPEN_REMIND_MODAL', taskId });
        } else if (hasValidHabit) {
          sameOriginClient.postMessage({ type: 'OPEN_MODAL', habitId });
        } else {
          sameOriginClient.postMessage({ type: 'OPEN_TODAY' });
        }
      } else {
        // タブが無ければ新規で開く
        await clients.openWindow(targetUrl);
      }
    })()
  );
});

// ---------- Service Worker ライフサイクル ----------
self.addEventListener('install', (event) => {
  console.log('[SW] installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activated');
  event.waitUntil(self.clients.claim());
});