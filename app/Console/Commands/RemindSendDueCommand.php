<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Carbon\Carbon;
use App\Models\RemindTask;
use App\Services\Push\WebPushSender;
use Illuminate\Support\Facades\Schema;

/**
 * remind:send-due
 *
 * - 「pending かつ remind_at <= now(JST)」の RemindTask を送信するだけ（生成はしない）
 * - SW 側が確実にモーダルを開けるよう、payload の data に
 *     taskId / habitId / url / type(OPEN_REMIND_MODAL)
 *   を **camelCase / snake_case 両方**で格納
 * - タグは `habit-reminder-task-{taskId}` に統一（data が空でも tag から復元できる）
 */
class RemindSendDueCommand extends Command
{
    protected $signature = 'remind:send-due
                            {--now= : Override current time in JST. ex: "2025-11-11 13:40:00"}
                            {--user= : Limit to a specific user ID}
                            {--limit=200 : Max tasks to send in one run}
                            {--dry-run : Log only, do not update status}';

    protected $description = 'Send due reminder notifications without generating new tasks. (JST comparison)';

    public function handle(): int
    {
        $tz       = config('app.timezone', 'Asia/Tokyo');
        $nowInput = $this->option('now');
        $nowJst   = $nowInput ? Carbon::parse($nowInput, $tz) : Carbon::now($tz);
        $nowStr   = $nowJst->toDateTimeString();

        $limit    = (int) $this->option('limit');
        $dryRun   = (bool) $this->option('dry-run');
        $userId   = $this->option('user') !== null ? (int)$this->option('user') : null;

        // due タスク抽出（必要最小限を先読み）
        $q = RemindTask::query()
            ->with(['habitLog.habit'])     // habit title 用
            ->where('status', 'pending')
            ->where('remind_at', '<=', $nowStr)
            ->orderBy('remind_at', 'asc');

        if ($userId) {
            $q->whereHas('habitLog', fn($qq) => $qq->where('user_id', $userId));
        }

        $tasks = $q->limit($limit)->get();

        $sender  = app(WebPushSender::class);
        $sent    = 0;
        $skipped = 0;
        $errors  = 0;

        foreach ($tasks as $task) {
            $log    = $task->habitLog;
            $habit  = $log?->habit;
            $owner  = $log?->user_id;

            if (!$owner || !$habit) { // 送信先不明など
                $skipped++;
                continue;
            }

            // SW で確実に拾えるペイロード（data を必ず入れる）
            $habitTitle = (string)($habit->title ?? $habit->name ?? '習慣');
            $payload = [
                'title' => '習慣リマインダー',
                'body'  => "「{$habitTitle}」の時間です！",
                'tag'   => "habit-reminder-task-{$task->id}",
                'data'  => [
                    'type'          => 'OPEN_REMIND_MODAL',
                    'url'           => url('/dashboard/today'),
                    // camelCase / snake_case 両対応
                    'taskId'        => (int)$task->id,
                    'task_id'       => (int)$task->id,
                    'habitId'       => (int)$habit->id,
                    'habit_id'      => (int)$habit->id,
                    'habitLogId'    => (int)$log->id,
                    'habit_log_id'  => (int)$log->id,
                    'when'          => $task->remind_at,
                ],
            ];

            if ($dryRun) {
                $this->line(sprintf('[DRY] send task#%d -> user#%d (%s) "%s"',
                    $task->id, $owner, $task->remind_at, $habitTitle
                ));
                $sent++;
                continue;
            }

            try {
                $delivered = $sender->sendToUser($owner, $payload); // 購読数（送付成功件数）を返す想定

                if ($delivered > 0) {
                    // sent_at カラムは無い前提。status のみ更新。
                    $task->update(['status' => 'sent', 'updated_at' => now()]);
                    $sent++;
                } else {
                    // 購読ゼロなど。pending のままでもよいが、運用上は skip。
                    $skipped++;
                }
            } catch (\Throwable $e) {
                $errors++;
                // 失敗時は error フィールドがあれば保存、なければ status=error のみ
                $attrs = ['status' => 'error', 'updated_at' => now()];
                if ($task->isFillable('error') || Schema::hasColumn($task->getTable(), 'error')) {
                    $attrs['error'] = $e->getMessage();
                }
                try { $task->update($attrs); } catch (\Throwable $ignore) {}
                $this->error(sprintf('[ERROR] task#%d: %s', $task->id, $e->getMessage()));
            }
        }

        $this->info(sprintf(
            'Reminder send at %s (JST): sent=%d skipped=%d errors=%d',
            $nowStr, $sent, $skipped, $errors
        ));

        return self::SUCCESS;
    }
}