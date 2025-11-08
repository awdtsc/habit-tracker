<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class HabitReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    protected int $habitId;
    protected string $habitTitle;
    protected bool $isSnooze;
    protected int $taskId;

    /**
     * @param int    $habitId
     * @param string $habitTitle
     * @param bool   $isSnooze  「あとでやる通知」か
     * @param int    $taskId    紐づく RemindTask のID（推奨: 必須）
     */
    public function __construct(int $habitId, string $habitTitle, bool $isSnooze = false, int $taskId = 0)
    {
        $this->habitId    = $habitId;
        $this->habitTitle = $habitTitle;
        $this->isSnooze   = $isSnooze;
        $this->taskId     = $taskId;
    }

    public function via($notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification = null): WebPushMessage
    {
        if ($this->taskId === 0) {
            Log::warning('[WebPush] taskId is 0 (missing). SW may not open modal correctly.', [
                'user_id' => $notifiable->id,
                'habitId' => $this->habitId,
            ]);
        }

        Log::info('[WebPush] toWebPush payload', [
            'user_id'    => $notifiable->id,
            'habitId'    => $this->habitId,
            'habitTitle' => $this->habitTitle,
            'isSnooze'   => $this->isSnooze,
            'taskId'     => $this->taskId,
        ]);

        // task 単位でユニークなタグ（taskId が無ければ habitId+時刻でフォールバック）
        $tag = $this->taskId > 0
            ? "habit-reminder-task-{$this->taskId}"
            : 'habit-reminder-fallback-' . $this->habitId . '-' . now()->format('Ymd-His');

        return (new WebPushMessage)
            ->title('習慣リマインダー')
            ->body("「{$this->habitTitle}」の時間です！")
            ->icon('/icons/icon-192x192.png')
            ->badge('/icons/badge.png')
            ->tag($tag)
            // ⚠️ SW 側の実装差異を吸収するため camelCase / snake_case の両方を入れる
            ->data([
                'type'     => 'OPEN_REMIND_MODAL',
                'url'      => url('/dashboard/today'),
                'habitId'  => $this->habitId,   // camelCase
                'habit_id' => $this->habitId,   // snake_case（互換）
                'taskId'   => $this->taskId,    // camelCase（推奨）
                'task_id'  => $this->taskId,    // snake_case（互換）
                'snooze'   => $this->isSnooze,
            ])
            // TTL 等は必要に応じて
            ->options(['TTL' => 60 * 30, 'urgency' => 'high']);
    }
}