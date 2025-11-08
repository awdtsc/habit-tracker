<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB; // ← 追加
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class PushDebugController extends Controller
{
    /**
     * POST /api/push/debug
     * 認証ユーザーの最新購読へテスト通知を1通送る
     */
    public function send(Request $request)
    {
        $user = $request->user();

        // あなたの実装に合わせてテーブル名/カラム名を調整してください
        // 例: push_subscriptions: id, user_id, endpoint, p256dh, auth, contentEncoding
        $sub = DB::table('push_subscriptions')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->first();

        if (!$sub) {
            return response()->json(['ok' => false, 'reason' => 'no subscription'], 404);
        }

        $subscription = Subscription::create([
            'endpoint' => $sub->endpoint,
            'keys' => [
                'p256dh' => $sub->p256dh,
                'auth'   => $sub->auth,
            ],
        ]);

        $payload = json_encode([
            'title' => 'テスト通知',
            'body'  => 'これは /api/push/debug からのテストです',
            'tag'   => 'habit-debug',
            'data'  => [
                'url'     => '/dashboard/today',
                'taskId'  => 0,
                'habitId' => 0,
            ],
        ], JSON_UNESCAPED_UNICODE);

        $auth = [
            'VAPID' => [
                'subject'    => config('app.url') ?: env('VAPID_SUBJECT', 'mailto:admin@example.com'),
                'publicKey'  => env('VAPID_PUBLIC_KEY'),
                'privateKey' => env('VAPID_PRIVATE_KEY'),
            ],
        ];

        $webPush = new WebPush($auth);

        // Minishlink v5/v6 互換の安全形：
        // 第3引数には options 配列のみ渡す（true は渡さない）。
        $report = $webPush->sendOneNotification(
            $subscription,
            $payload,
            [
                'TTL'              => 30,
                'urgency'          => 'high',
                // Chrome は通常 aes128gcm。省略も可だが、明示しておく。
                'contentEncoding'  => 'aes128gcm',
            ]
        );

        // 送信を確定（キューを空に）
        foreach ($webPush->flush() as $r) {
            // $r は \Minishlink\WebPush\MessageSentReport
            $ok = $r->isSuccess();
            Log::info('[PushDebug] report', [
                'endpoint' => $r->getRequest()->getUri()->__toString(),
                'success'  => $ok,
                'reason'   => $ok ? null : $r->getReason(),
                'status'   => $r->getResponse() ? $r->getResponse()->getStatusCode() : null,
            ]);

            if (!$ok) {
                $status = $r->getResponse() ? $r->getResponse()->getStatusCode() : 500;
                return response()->json([
                    'ok'     => false,
                    'status' => $status,
                    'reason' => $r->getReason(),
                ], 500);
            }
        }

        return response()->json(['ok' => true]);
    }
}