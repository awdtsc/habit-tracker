<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushSubscriptionController extends Controller
{
    public function store(Request $req)
    {
        $user = $req->user() ?? User::find(1); // 認証なしテストなら user_id=1 固定
        if (!$user) {
            return response()->json(['ok' => false, 'msg' => 'user not found'], 404);
        }

        // ★ JSONとして受け取る（ここが重要）
        $data = $req->json()->all();

        // sub.toJSON() そのままの形を想定：{ endpoint, keys:{p256dh,auth}, ... }
        $encoding = $data['contentEncoding'] ?? 'aes128gcm';

        // morphリレーション経由で保存
        $user->pushSubscriptions()->updateOrCreate(
            ['endpoint' => $data['endpoint']],
            [
                'public_key'       => $data['keys']['p256dh'] ?? null,
                'auth_token'       => $data['keys']['auth'] ?? null,
                'content_encoding' => $encoding,
            ]
        );

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $req)
    {
        $endpoint = $req->validate(['endpoint' => 'required|string'])['endpoint'];
        PushSubscription::where('endpoint', $endpoint)->delete();
        return ['ok' => true];
    }

    public function test(Request $req)
    {
        Log::info('[SSL diag]', [
            'ini_curl_cainfo'      => ini_get('curl.cainfo'),
            'ini_openssl_cafile'   => ini_get('openssl.cafile'),
            'env_SSL_CERT_FILE'    => getenv('SSL_CERT_FILE'),
            'env_CURL_CA_BUNDLE'   => getenv('CURL_CA_BUNDLE'),
            'env_OPENSSL_CONF'     => getenv('OPENSSL_CONF'),
        ]);

        $user = $req->user() ?? User::find(1);
        if (!$user) return response()->json(['ok' => false, 'msg' => 'user not found'], 404);

        // morph で紐づいた最新購読を取得
        $sub = PushSubscription::where('subscribable_type', User::class)
            ->where('subscribable_id', $user->id)
            ->latest()
            ->first();

        if (!$sub) {
            return response()->json(['ok' => false, 'msg' => 'no subscription'], 404);
        }

        $webPush = new WebPush([], [
            'VAPID' => [
                'subject'    => config('services.webpush.subject'),
                'publicKey'  => config('services.webpush.public_key'),
                'privateKey' => config('services.webpush.private_key'),
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
            ])
        );

        $result = null;
        foreach ($webPush->flush() as $report) {
            if ($report->isSubscriptionExpired()) {
                $sub->delete();
            }
            $result = [
                'ok'       => $report->isSuccess(),
                'status'   => $report->getReason(),
                'endpoint' => $report->getEndpoint(),
            ];
        }

        return $result ?: ['ok' => false, 'status' => 'no report'];
    }
}