<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Models\RemindTask;
use App\Models\PushSubscription;
use App\Models\User;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class SendHabitReminders extends Command
{
    protected $signature   = 'habits:send-reminders {--limit=200} {--force-due}';
    protected $description = 'Send habit reminder notifications (pending -> sent + WebPush).';

    public function handle(): int
    {
        $now       = now();
        $limit     = (int) $this->option('limit');
        $forceDue  = (bool) $this->option('force-due');

        Log::info('[RemindCmd] running', [
            'now'       => $now->toDateTimeString(),
            'force_due' => $forceDue,
        ]);

        // まず生テーブルを見ておくと「0件問題」が分かりやすい
        $rawPending = DB::table('remind_tasks')
            ->where('status', 'pending')
            ->get();

        Log::info('[RemindCmd] snapshot(raw)', [
            'pending_count' => $rawPending->count(),
            'rows'          => $rawPending,
        ]);

        // Eloquent 側の拾い方
        $q = RemindTask::query()
            ->where('status', 'pending')
            ->with(['habitLog.habit.user'])
            ->orderBy('remind_at');

        if (! $forceDue) {
            // 通常は期限が来たものだけ
            $q->where('remind_at', '<=', $now);
        }

        $tasks = $q->limit($limit)->get();

        Log::info('[RemindCmd] picked', [
            'picked' => $tasks->count(),
        ]);

        if ($tasks->isEmpty()) {
            return self::SUCCESS;
        }

        // VAPID が無い環境では null
        $webPush = $this->makeWebPush();

        // ここでまとめて送るためのキューを積む
        foreach ($tasks as $task) {
            // ① 先に pending → sent にしておく（多重送信防止）
            $update = [
                'status'     => 'sent',
                'updated_at' => now(),
            ];
            if (Schema::hasColumn('remind_tasks', 'sent_at')) {
                $update['sent_at'] = now();
            }

            $affected = DB::table('remind_tasks')
                ->where('id', $task->id)
                ->where('status', 'pending')
                ->update($update);

            if ($affected === 0) {
                Log::info('[RemindCmd] skip (already changed)', ['task_id' => $task->id]);
                continue;
            }

            // 関係を取り直す（さっきの $task は古い可能性がある）
            $task     = RemindTask::with(['habitLog.habit.user'])->find($task->id);
            $habitLog = $task->habitLog;
            $habit    = $habitLog->habit ?? null;
            $user     = $habit?->user;

            if (! $user || ! $habit) {
                Log::warning('[RemindCmd] missing relation(s)', [
                    'task_id' => $task->id,
                    'user'    => $user?->id,
                    'habit'   => $habit?->id,
                ]);
                $this->markError($task);
                continue;
            }

            // push_subscriptions のカラム差異に両対応する
            // ① 新しい laravel-notification-channels/webpush 形式: subscribable_id / subscribable_type
            // ② 独自に user_id を持たせた場合
            $subsQuery = PushSubscription::query();

            if (Schema::hasColumn('push_subscriptions', 'user_id')) {
                $subsQuery->where(function ($qq) use ($user) {
                    $qq->where('user_id', $user->id)
                        ->orWhere(function ($qq2) use ($user) {
                            $qq2->where('subscribable_id', $user->id)
                                ->where('subscribable_type', User::class);
                        });
                });
            } else {
                $subsQuery->where('subscribable_id', $user->id)
                    ->where('subscribable_type', User::class);
            }

            $subs = $subsQuery->get();

            if ($subs->isEmpty()) {
                Log::info('[RemindCmd] user has no subscriptions', [
                    'user_id' => $user->id,
                    'task_id' => $task->id,
                ]);
                // sent にはしたのでここで終了
                continue;
            }

            $payload = [
                'title'   => '習慣リマインド',
                'body'    => $habit->title ? "「{$habit->title}」の時間です" : 'そろそろ習慣の時間です',
                'taskId'  => $task->id,
                'habitId' => $habit->id,
                'url'     => '/dashboard/today',
                'data'    => [
                    'taskId'  => $task->id,
                    'habitId' => $habit->id,
                    'url'     => '/dashboard/today',
                ],
            ];

            // 実送信を積む
            if ($webPush instanceof WebPush) {
                foreach ($subs as $sub) {
                    $subscription = $this->toWebPushSubscription($sub);

                    if (! $subscription) {
                        continue;
                    }

                    // ★ ここが sendNotification じゃなくて queueNotification
                    $webPush->queueNotification(
                        $subscription,
                        json_encode($payload, JSON_UNESCAPED_UNICODE)
                    );
                }
            } else {
                Log::warning('[RemindCmd] WebPush not configured -> skip actual push', [
                    'task_id' => $task->id,
                    'user_id' => $user->id,
                ]);
            }
        }

        // ここでまとめて投げる
        if ($webPush instanceof WebPush) {
            foreach ($webPush->flush() as $report) {
                $endpoint = $report->getRequest()->getUri()->__toString();
                if ($report->isSuccess()) {
                    Log::info('[RemindCmd] push ok', ['endpoint' => $endpoint]);
                } else {
                    Log::warning('[RemindCmd] push failed', [
                        'endpoint' => $endpoint,
                        'reason'   => $report->getReason(),
                    ]);
                }
            }
        }

        return self::SUCCESS;
    }

    protected function makeWebPush(): ?WebPush
    {
        $public  = config('webpush.vapid.public_key');
        $private = config('webpush.vapid.private_key');

        if (! $public || ! $private) {
            return null;
        }

        return new WebPush([
            'VAPID' => [
                'subject'    => config('webpush.vapid.subject', 'mailto:example@example.com'),
                'publicKey'  => $public,
                'privateKey' => $private,
            ],
        ]);
    }

    /**
     * NotificationChannels のレコード → Minishlink の Subscription へ変換
     */
    protected function toWebPushSubscription(PushSubscription $sub): ?Subscription
    {
        // vendor が持ってる実際の構造に合わせる
        $endpoint = $sub->endpoint;
        if (! $endpoint) {
            return null;
        }

        $publicKey = $sub->public_key ?? $sub->key ?? null;
        $authToken = $sub->auth_token ?? $sub->token ?? null;

        return Subscription::create([
            'endpoint' => $endpoint,
            'keys'     => [
                'p256dh' => $publicKey,
                'auth'   => $authToken,
            ],
        ]);
    }

    protected function markError(RemindTask $task): void
    {
        $update = [
            'status'     => 'error',
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('remind_tasks', 'error_at')) {
            $update['error_at'] = now();
        }

        DB::table('remind_tasks')
            ->where('id', $task->id)
            ->update($update);
    }
}