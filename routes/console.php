<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
// use Illuminate\Support\Facades\Schedule; // [CHANGED] スケジューラ定義は Kernel に一本化するため未使用に
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Models\RemindTask;
use App\Notifications\HabitReminderNotification;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| ⚠️ スケジュール（$schedule->... や Schedule::command(...)）は
|    すべて app/Console/Kernel.php の schedule() に一本化します。  // [CHANGED]
|    ここには「手動実行コマンド（Artisan::command）」のみを残します。 // [CHANGED]
|
| 以前ここにあった:
|   - Schedule::command('remind:schedule-due')->everyMinute()
|   - Heartbeat ログ
|   - reminders:dispatch
|   - habits:init-daily
| は **削除** しました。                                      // [CHANGED]
|
*/

/*
|--------------------------------------------------------------------------
| Ad-hoc: dueタスクをその場で1回だけ送る（手動チェック用）
|--------------------------------------------------------------------------
| 使い方: php artisan remind:dispatch-once
*/
Artisan::command('remind:dispatch-once', function () {
    $now = Carbon::now();

    $tasks = RemindTask::query()
        ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
        ->where('remind_at', '<=', $now)
        ->with('habitLog.habit.user')
        ->get();

    if ($tasks->isEmpty()) {
        $this->info('No due tasks.');
        return self::SUCCESS;
    }

    Log::info("[Remind(cmd)] running at {$now->toDateTimeString()}");
    $this->info("Found {$tasks->count()} task(s)");

    foreach ($tasks as $task) {
        $log   = $task->habitLog;
        $habit = $log?->habit;
        $user  = $habit?->user;

        if (!$log || !$habit || !$user) {
            Log::warning('[Remind(cmd)] missing relation', ['task_id' => $task->id]);
            DB::table('remind_tasks')
                ->where('id', $task->id)
                ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                ->update([
                    'status'     => RemindTask::STATUS_ERROR ?? 'error',
                    'updated_at' => now(),
                ]);
            continue;
        }

        if ($log->status === 'done') {
            Log::info('[Remind(cmd)] skipped (already done)', [
                'task_id' => $task->id,
                'habit'   => $habit->title ?? $habit->name ?? "(id:{$habit->id})",
                'user'    => $user->id,
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
            $user->notify(new HabitReminderNotification(
                (int) $habit->id,
                (string) ($habit->title ?? $habit->name ?? ''),
                false,
                (int) $task->id
            ));

            Log::info('[Remind(cmd)] sent', [
                'task_id'  => $task->id,
                'habit_id' => $habit->id,
                'habit'    => $habit->title ?? $habit->name ?? '',
                'user'     => $user->id,
            ]);

            $payload = [
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

        } catch (\Throwable $e) {
            Log::error('[Remind(cmd)] fail', [
                'task_id' => $task->id,
                'error'   => $e->getMessage(),
            ]);

            DB::table('remind_tasks')
                ->where('id', $task->id)
                ->where('status', RemindTask::STATUS_PENDING ?? 'pending')
                ->update([
                    'status'     => RemindTask::STATUS_ERROR ?? 'error',
                    'updated_at' => now(),
                ]);
        }
    }

    return self::SUCCESS;
})->purpose('Dispatch due RemindTasks once (manual)');

// サンプル（残してOK）
Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');