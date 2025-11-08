<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class TestPushNotification extends Notification
{
    use Queueable;

    public function via($notifiable)
    {
        // Laravel WebPush チャネルを明示
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        return (new WebPushMessage)
            ->title('🎯 テスト通知')
            ->body('これは Habit Tracker からのテスト通知です！')
            // アイコンは暫定で PWA 用の既定パスに
            ->icon('/icons/icon-192x192.png')
            // SW 側でクリック先に使えるデータ
            ->data(['url' => url('/dashboard/today')])
            // アクション（SW の notificationclick で event.action === "open_app" を拾う）
            ->action('表示', 'open_app')
            // 任意: 同一タグで通知をまとめる
            ->tag('test-push')
            // 任意: TTL(秒)
            ->options(['TTL' => 300]);
    }
}