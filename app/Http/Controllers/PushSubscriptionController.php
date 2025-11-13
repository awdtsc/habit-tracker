<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * PushSubscriptionController
 *
 * 目的：
 *  - 同一 endpoint はユーザー毎に冪等保存（updateOrCreate）
 *  - 失敗時は例外を握って原因を返す（500 の撲滅）
 *  - 開発環境のみ user_id=1 フォールバック許可
 *
 * 前提（推奨のDB設計）：
 *  - push_subscriptions に複合ユニーク：
 *      UNIQUE (subscribable_type, subscribable_id, endpoint)
 *  - カラム:
 *      id, subscribable_type, subscribable_id, endpoint,
 *      public_key, auth_token, content_encoding, user_agent,
 *      device_hint, last_seen_at, created_at, updated_at
 */
class PushSubscriptionController extends Controller
{
    /**
     * 保存（同一 endpoint は update）
     * リクエスト例：navigator.serviceWorker.ready → pushManager.getSubscription().toJSON()
     * {
     *   endpoint: "...",
     *   keys: { p256dh: "...", auth: "..." },
     *   contentEncoding: "aes128gcm" | "aesgcm" など
     * }
     */
    public function store(Request $req)
    {
        $user = $req->user();
        if (!$user && app()->environment('local')) {
            $user = User::find(1);
        }
        if (!$user) {
            return response()->json(['ok' => false, 'error' => 'unauthenticated'], 401);
        }

        try {
            // 生 payload（getSubscription().toJSON() 互換 or 自前整形の両対応）
            $payload   = $req->json()->all();

            // endpoint
            $endpoint = trim((string) data_get($payload, 'endpoint', ''));
            // keys (nested/flat両対応)
            $p256dh   = data_get($payload, 'keys.p256dh', data_get($payload, 'p256dh'));
            $auth     = data_get($payload, 'keys.auth',   data_get($payload, 'auth'));

            // encoding の正規化
            $encoding = strtolower((string) data_get($payload, 'contentEncoding', 'aes128gcm'));
            if (!in_array($encoding, ['aes128gcm','aesgcm','aesgcm256'], true)) {
                $encoding = 'aes128gcm';
            }

            // user_agent / device_hint 任意
            $userAgent  = (string) ($payload['user_agent']  ?? $req->userAgent() ?? '');
            $deviceHint = (string) ($payload['device_hint'] ?? '');

            // バリデーション（422を明示）
            if ($endpoint === '' || !$p256dh || !$auth) {
                throw ValidationException::withMessages([
                    'endpoint' => ['endpoint is required'],
                    'keys'     => ['keys.p256dh / keys.auth are required'],
                ]);
            }

            // 冪等保存（ユーザー毎のmorphMany前提）
            // ※ 複合ユニークが (subscribable_type, subscribable_id, endpoint) の場合でも
            //    morphMany()->updateOrCreate(['endpoint' => ...], [...]) で OK
            $sub = $user->pushSubscriptions()->updateOrCreate(
                ['endpoint' => $endpoint],
                [
                    'public_key'       => $p256dh,
                    'auth_token'       => $auth,
                    'content_encoding' => $encoding,
                    'user_agent'       => mb_substr($userAgent, 0, 255),
                    'device_hint'      => $deviceHint !== '' ? mb_substr($deviceHint, 0, 255) : null,
                    'last_seen_at'     => now(),
                ]
            );

            return response()->json([
                'ok'   => true,
                'mode' => $sub->wasRecentlyCreated ? 'created' : 'updated',
                'id'   => $sub->id,
            ], $sub->wasRecentlyCreated ? 201 : 200);
        } catch (ValidationException $ve) {
            return response()->json([
                'ok'    => false,
                'error' => 'validation_error',
                'detail'=> $ve->errors(),
            ], 422);
        } catch (Throwable $e) {
            // 例外を握って 409/500 を使い分け（ユニーク衝突の可能性もここで吸収）
            Log::warning('[PushSubscription.store] failed', [
                'user_id'  => $user?->id,
                'message'  => $e->getMessage(),
                'class'    => get_class($e),
            ]);

            // DBユニーク制約などの可能性 → 409 に寄せる
            $code = (stripos($e->getMessage(), 'duplicate') !== false ||
                     stripos($e->getMessage(), 'unique') !== false) ? 409 : 500;

            return response()->json([
                'ok'    => false,
                'error' => $code === 409 ? 'conflict' : 'server_error',
                'hint'  => 'check unique(subscribable_type, subscribable_id, endpoint) and payload format',
            ], $code);
        }
    }

    /**
     * 削除（冪等）
     * body: { endpoint: "..." }
     */
    public function destroy(Request $req)
    {
        $user = $req->user();
        if (!$user && app()->environment('local')) {
            $user = User::find(1);
        }
        if (!$user) {
            return response()->json(['ok' => false, 'error' => 'unauthenticated'], 401);
        }

        $data = $req->validate(['endpoint' => 'required|string']);
        $deleted = $user->pushSubscriptions()->where('endpoint', $data['endpoint'])->delete();

        return response()->json(['ok' => true, 'deleted' => $deleted], 200);
    }

    /**
     * テスト送信（local / testing のみ）
     */
    public function test(Request $req)
    {
        if (! app()->environment(['local','testing'])) {
            return response()->json(['ok' => false, 'error' => 'forbidden'], 403);
        }

        Log::info('[PushSubscription.test] SSL env', [
            'ini_curl_cainfo'    => ini_get('curl.cainfo'),
            'ini_openssl_cafile' => ini_get('openssl.cafile'),
            'env_SSL_CERT_FILE'  => getenv('SSL_CERT_FILE'),
            'env_CURL_CA_BUNDLE' => getenv('CURL_CA_BUNDLE'),
            'env_OPENSSL_CONF'   => getenv('OPENSSL_CONF'),
        ]);

        $user = $req->user() ?? User::find(1);
        if (!$user) {
            return response()->json(['ok' => false, 'msg' => 'user not found'], 404);
        }

        /** @var PushSubscription|null $sub */
        $sub = PushSubscription::query()
            ->where('subscribable_type', User::class)
            ->where('subscribable_id', $user->id)
            ->latest()
            ->first();

        if (!$sub) {
            return response()->json(['ok' => false, 'msg' => 'no subscription'], 404);
        }

        $webPush = new WebPush([], [
            'VAPID' => [
                'subject'    => (string) config('services.webpush.subject'),
                'publicKey'  => (string) config('services.webpush.public_key'),
                'privateKey' => (string) config('services.webpush.private_key'),
            ],
        ]);

        $webPush->queueNotification(
            Subscription::create([
                'endpoint'        => $sub->endpoint,
                'publicKey'       => $sub->public_key,
                'authToken'       => $sub->auth_token,
                'contentEncoding' => $sub->content_encoding ?? 'aes128gcm',
            ]),
            json_encode([
                'title'    => 'テスト通知',
                'body'     => 'これはサーバからのテストです',
                'url'      => url('/dashboard/today'),
                'habit_id' => 999,
            ], JSON_UNESCAPED_UNICODE)
        );

        $report = null;
        foreach ($webPush->flush() as $r) {
            if ($r->isSubscriptionExpired()) {
                // 期限切れ → クリーンアップ
                $sub->delete();
            }
            $report = [
                'ok'       => $r->isSuccess(),
                'status'   => $r->getReason(),
                'endpoint' => $r->getEndpoint(),
            ];
        }

        return response()->json($report ?: ['ok' => false, 'status' => 'no report'], 200);
    }
}
