<?php

namespace App\Jobs;

use App\Models\RemindTask;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class DispatchDueRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** 一括処理件数（バースト対策） */
    public int $batchSize = 200;

    public function handle(): void
    {
        $now = now(config('app.timezone', 'Asia/Tokyo'));

        // 期限到来の pending のみ
        $tasks = RemindTask::query()
            ->where('status', RemindTask::STATUS_PENDING)
            ->where('remind_at', '<=', $now)
            ->with('habitLog.habit.user')
            ->orderBy('remind_at')
            ->limit($this->batchSize)
            ->get();

        if ($tasks->isEmpty()) {
            Log::debug('[Remind] due=0 '.$now);
            return;
        }

        Log::info('[Remind] due='.$tasks->count().' @ '.$now->toDateTimeString());

        foreach ($tasks as $task) {
            try {
                $log   = $task->habitLog;
                $habit = $log?->habit;
                $user  = $habit?->user;

                // 関連欠損は error 扱い（★ pending のものだけ原子的に更新）
                if (!$log || !$habit || !$user) {
                    Log::warning('[Remind] missing relation', ['task_id' => $task->id]);

                    DB::table('remind_tasks')
                        ->where('id', $task->id)
                        ->where('status', RemindTask::STATUS_PENDING)
                        ->update([
                            'status'     => RemindTask::STATUS_ERROR,
                            'updated_at' => now(),
                        ]);

                    continue;
                }

                // 既にHabitLogが done なら通知せず skipped に（★ pending 限定）
                if ($log->status === 'done') {
                    DB::table('remind_tasks')
                        ->where('id', $task->id)
                        ->where('status', RemindTask::STATUS_PENDING)
                        ->update([
                            'status'     => RemindTask::STATUS_SKIPPED,
                            'updated_at' => now(),
                        ]);

                    Log::info('[Remind] skipped (already done)', ['task_id' => $task->id]);
                    continue;
                }

                // === 通知送信 ===
                $user->notify(new \App\Notifications\HabitReminderNotification(
                    habitId:    (int) $habit->id,
                    habitTitle: (string) ($habit->title ?? ''),
                    isSnooze:   false,
                    taskId:     (int) $task->id
                ));

                // 送信済みに（★ pending のものだけ原子的に更新）
                $payload = [
                    'status'     => RemindTask::STATUS_SENT,
                    'updated_at' => now(),
                ];
                if (Schema::hasColumn('remind_tasks', 'sent_at')) {
                    $payload['sent_at'] = now();
                }

                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING)
                    ->update($payload);

                Log::info('[Remind] sent', ['task_id' => $task->id]);
            } catch (\Throwable $e) {
                // 送信失敗は error に（★ pending 限定）
                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING)
                    ->update([
                        'status'     => RemindTask::STATUS_ERROR,
                        'updated_at' => now(),
                    ]);

                Log::error('[Remind] send failed', [
                    'task_id' => $task->id,
                    'error'   => $e->getMessage(),
                ]);

                // 必要に応じて再試行
                // $this->release(60);
            }
        }
    }
}