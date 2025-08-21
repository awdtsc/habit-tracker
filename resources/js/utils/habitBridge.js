// 同一ページ / 別ページ / 別タブ すべてをカバーする橋渡し
const CHANNEL = 'habit-sync-v1';
let bc = null;
try { if ('BroadcastChannel' in window) bc = new BroadcastChannel(CHANNEL); } catch {}

export function emitHabitChange(detail) {
  const msg = { ...detail, type: 'habit:change', ts: Date.now() };

  // 同一ページ（同一SPA内）
  window.dispatchEvent(new CustomEvent('habit:change', { detail: msg }));

  // 別タブ・別ウィンドウ
  bc?.postMessage(msg);

  // フォールバック（storage イベント）
  try {
    localStorage.setItem('__habit_change__', JSON.stringify(msg));
    localStorage.removeItem('__habit_change__');
  } catch {}
}

export function listenHabitChange(handler) {
  const onWin = (e) => handler(e.detail);
  window.addEventListener('habit:change', onWin);

  const onStorage = (e) => {
    if (e.key === '__habit_change__' && e.newValue) handler(JSON.parse(e.newValue));
  };
  window.addEventListener('storage', onStorage);

  let onBc = null;
  if (bc) { onBc = (e) => handler(e.data); bc.addEventListener('message', onBc); }

  return () => {
    window.removeEventListener('habit:change', onWin);
    window.removeEventListener('storage', onStorage);
    if (bc && onBc) bc.removeEventListener('message', onBc);
    try { bc?.close(); } catch {}
  };
}