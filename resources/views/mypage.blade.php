<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>マイページ（仮）</title>
    @vite('resources/js/app.js')
</head>
<body class="p-6">
    <h1 class="text-xl mb-4">マイページ（仮）</h1>

    <button id="enablePush" class="px-4 py-2 bg-blue-500 text-white rounded">
        通知を有効化する
    </button>

    <script>
        function urlBase64ToUint8Array(base64String) {
            const padding = "=".repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding)
                .replace(/-/g, "+")
                .replace(/_/g, "/");
            const rawData = atob(base64);
            return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
        }

        document.getElementById("enablePush").addEventListener("click", async () => {
            try {
                const reg = await navigator.serviceWorker.ready;
                const vapidKey = "{{ config('webpush.vapid.public_key') }}";
                const convertedKey = urlBase64ToUint8Array(vapidKey);

                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedKey,
                });

                const res = await fetch("/api/push/subscribe", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-TOKEN": "{{ csrf_token() }}"
                    },
                    body: JSON.stringify(sub),
                });

                if (res.ok) {
                    alert("通知を有効化しました！");
                } else {
                    alert("通知登録に失敗しました");
                }
            } catch (err) {
                console.error("購読エラー:", err);
                alert("通知を有効化できませんでした");
            }
        });
    </script>
</body>
</html>