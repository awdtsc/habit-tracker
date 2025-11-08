<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;                 // [CHANGED]
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;                                 // [CHANGED]
use App\Models\RemindTask;
use App\Notifications\HabitReminderNotification;   // [CHANGED]

class DispatchReminders extends Command
{
    /** artisan signature */
    protected $signature   = 'reminders:dispatch {--limit=200}';
    /** description */
    protected $description = 'Dispatch due RemindTasks (sync push, no queue)'; // [CHANGED]

    public function handle(): int
    {
        $limit = (int) $this->option('limit') ?: 200; // [CHANGED]

        // 期日到来 & pending のみ抽出
        $tasks = RemindTask::query()                  // [CHANGED]
            ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
            ->where('remind_at', '<=', Carbon::now())
            ->with('habitLog.habit.user')            // push 送信に必要な関連をロード
            ->orderBy('remind_at')
            ->limit($limit)
            ->get();

        if ($tasks->isEmpty()) {
            $this->info('No due tasks.');
            return self::SUCCESS;
        }

        Log::info('[Remind(dispatch)] start', ['count' => $tasks->count()]); // [CHANGED]
        $this->info("Dispatching {$tasks->count()} task(s)...");

        foreach ($tasks as $task) {
            $log   = $task->habitLog;
            $habit = $log?->habit;
            $user  = $habit?->user;

            // 関連欠落 → error
            if (!$log || !$habit || !$user) {        // [CHANGED]
                Log::warning('[Remind(dispatch)] missing relation', ['task_id' => $task->id]);
                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                    ->update([
                        'status'     => RemindTask::STATUS_ERROR ?? 'error',
                        'updated_at' => now(),
                    ]);
                continue;
            }

            // 既に done → skipped
            if ($log->status === 'done') {           // [CHANGED]
                Log::info('[Remind(dispatch)] skipped(done)', [
                    'task_id'  => $task->id,
                    'habit_id' => $habit->id,
                    'user'     => $user->id,
                ]);

                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                    ->update([
                        'status'     => RemindTask::STATUS_SKIPPED ?? 'skipped',
                        'updated_at' => now(),
                    ]);
                continue;
            }

            try {
                // ======== ★ 同期送信に統一（notifyNow） ======== // [CHANGED]
                $user->notifyNow(new HabitReminderNotification(
                    (int) $habit->id,
                    (string) ($habit->title ?? $habit->name ?? ''),
                    false,
                    (int) $task->id
                ));
                // ==============================================

                Log::info('[Remind(dispatch)] sent', [
                    'task_id'  => $task->id,
                    'habit_id' => $habit->id,
                    'user'     => $user->id,
                ]);

                // 成功したもののみ sent に更新
                $payload = [                           // [CHANGED]
                    'status'     => RemindTask::STATUS_SENT ?? 'sent',
                    'updated_at' => now(),
                ];
                if (Schema::hasColumn('remind_tasks', 'sent_at')) {
                    $payload['sent_at'] = now();
                }

                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                    ->update($payload);

                $this->line("Sent reminder #{$task->id} (habit_log_id={$task->habit_log_id})");

            } catch (\Throwable $e) {                 // [CHANGED]
                Log::error('[Remind(dispatch)] fail', [
                    'task_id' => $task->id,
                    'error'   => $e->getMessage(),
                ]);

                // 送信失敗は error（pending へ戻したい場合はここで再変更）
                DB::table('remind_tasks')
                    ->where('id', $task->id)
                    ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                    ->update([
                        'status'     => RemindTask::STATUS_ERROR ?? 'error',
                        'updated_at' => now(),
                    ]);
            }
        }

        Log::info('[Remind(dispatch)] done');         // [CHANGED]
        return self::SUCCESS;
    }
}