<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushController extends Controller
{
    public function sendTest()
    {
        $subscription = Subscription::create([
            "endpoint" => "ここにブラウザから取得した endpoint",
            "publicKey" => "ここにブラウザから取得した p256dh",
            "authToken" => "ここにブラウザから取得した auth",
        ]);

        $auth = [
            'VAPID' => [
                'subject' => config('services.webpush.subject'),
                'publicKey' => config('services.webpush.public_key'),
                'privateKey' => config('services.webpush.private_key'),
            ],
        ];

        $webPush = new WebPush($auth);

        // ★ habit_id を含めた payload
        $payload = json_encode([
            "title" => "テスト通知",
            "body" => "これはHabit Trackerからのテスト通知です！",
            "habit_id" => 123,
        ]);

        $webPush->queueNotification($subscription, $payload);

        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                echo "送信成功: {$report->getEndpoint()}\n";
            } else {
                echo "送信失敗: {$report->getEndpoint()} - {$report->getReason()}\n";
            }
        }
    }
}