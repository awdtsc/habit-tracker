<?php

namespace App\Services\Push;

use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * WebPushSender
 *
 * - ペイロードは **必ず JSON 文字列** で送信（配列のままだと SW 側で data が空になる実装がある）
 * - モデルのカラム名差異（p256dh/public_key, auth/auth_token）を吸収
 * - 410/404（購読失効）は DB から購読を削除
 */
class WebPushSender
{
    private WebPush $webPush;

    public function __construct(?WebPush $webPush = null)
    {
        // DI が無ければ自前生成
        $this->webPush = $webPush ?? $this->createWebPush();
        // ペイロードの自動パディングは 0（実運用に合わせて調整可）
        $this->webPush->setAutomaticPadding(0);
    }

    /**
     * 指定ユーザーの全購読へ送信。成功件数（配送成功数）を返す。
     *
     * @param int   $userId
     * @param array $payload  {title, body, tag, data:{...}} 形式推奨
     * @param array $options  例: ['TTL' => 1800, 'urgency' => 'high']
     * @return int  配送成功数
     */
    public function sendToUser(int $userId, array $payload, array $options = []): int
    {
        $subs = PushSubscription::where('user_id', $userId)->get();
        if ($subs->isEmpty()) {
            Log::info('[WebPush] no subscriptions for user', ['user_id' => $userId]);
            return 0;
        }

        // JSON 文字列化（日本語/スラッシュはエスケープしない）
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            Log::error('[WebPush] payload json_encode failed', [
                'user_id' => $userId,
                'error'   => json_last_error_msg(),
                'payload' => $payload,
            ]);
            return 0;
        }

        // 既定オプション
        $pushOptions = array_replace([
            'TTL'     => 60 * 30, // 30分
            'urgency' => 'high',
        ], $options);

        // 送信キュー
        foreach ($subs as $s) {
            try {
                $publicKey = $s->p256dh ?? $s->public_key ?? null;
                $authToken = $s->auth   ?? $s->auth_token ?? null;
                $encoding  = $s->content_encoding ?: 'aes128gcm';

                if (!$s->endpoint || !$publicKey || !$authToken) {
                    Log::warning('[WebPush] invalid subscription skipped', [
                        'id'       => $s->id,
                        'endpoint' => $s->endpoint,
                        'p256dh'   => (bool)$publicKey,
                        'auth'     => (bool)$authToken,
                    ]);
                    continue;
                }

                $sub = Subscription::create([
                    'endpoint'        => $s->endpoint,
                    'publicKey'       => $publicKey,
                    'authToken'       => $authToken,
                    'contentEncoding' => $encoding,
                ]);

                $this->webPush->queueNotification($sub, $json, $pushOptions);
            } catch (Throwable $e) {
                Log::error('[WebPush] queueNotification error', [
                    'subscription_id' => $s->id ?? null,
                    'message'         => $e->getMessage(),
                ]);
            }
        }

        // フラッシュ実行と結果集計
        $delivered = 0;

        foreach ($this->webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();

            if ($report->isSuccess()) {
                $delivered++;
                continue;
            }

            $reason = $report->getReason();
            $status = $report->getResponse()?->getStatusCode();

            Log::warning('[WebPush] send failed', [
                'endpoint' => $endpoint,
                'status'   => $status,
                'reason'   => $reason,
            ]);

            // 失効購読は削除
            if (in_array($status, [404, 410], true)) {
                try {
                    PushSubscription::where('endpoint', $endpoint)->delete();
                } catch (Throwable $e) {
                    Log::error('[WebPush] failed to delete expired subscription', [
                        'endpoint' => $endpoint,
                        'message'  => $e->getMessage(),
                    ]);
                }
            }
        }

        Log::info('[WebPush] sendToUser result', [
            'user_id'   => $userId,
            'delivered' => $delivered,
            'count'     => $subs->count(),
        ]);

        return $delivered;
    }

    /**
     * VAPID 設定から WebPush を生成
     */
    private function createWebPush(): WebPush
    {
        $vapid = config('webpush.vapid', []);

        $auth = [
            'VAPID' => [
                'subject'    => $vapid['subject']     ?? env('VAPID_SUBJECT', 'mailto:admin@example.com'),
                'publicKey'  => $vapid['public_key']  ?? env('VAPID_PUBLIC_KEY'),
                'privateKey' => $vapid['private_key'] ?? env('VAPID_PRIVATE_KEY'),
            ],
        ];

        return new WebPush($auth);
    }
}