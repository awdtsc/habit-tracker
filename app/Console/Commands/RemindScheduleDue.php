<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * remind:schedule-due
 *
 * 目的:
 *  - 今日の notify_time を過ぎた HabitTime について、
 *    ・該当 Habit の「今日の HabitLog」を（なければ）作成
 *    ・その HabitLog にひもづく RemindTask(pending, remind_at=notify_ts) を（なければ）作成
 *
 * 特徴:
 *  - MariaDB 10.4 前提のため、ENUM 変更回避・冪等化のため INSERT IGNORE を使用
 *  - 重複はユニークキーで自然に吸収（HL: (habit_id,date)、RT: (habit_log_id,remind_at) を想定）
 *  - 習慣が archived=0, start_date <= TODAY を満たすもののみ対象
 */
class RemindScheduleDue extends Command
{
    protected $signature   = 'remind:schedule-due';
    protected $description = 'Create today HabitLog and pending RemindTask for due HabitTime';

    public function handle(): int
    {
        $now      = Carbon::now();
        $todayYmd = $now->toDateString(); // YYYY-MM-DD

        // 1) due になっている habit_times を抽出
        $dueTimes = DB::table('habit_times as ht')
            ->join('habits as h', 'h.id', '=', 'ht.habit_id')
            ->where('h.archived', 0)
            ->where(function ($q) use ($todayYmd) {
                $q->whereNull('h.start_date')
                  ->orWhere('h.start_date', '<=', $todayYmd);
            })
            ->whereNotNull('ht.notify_time')
            ->select([
                'ht.id as habit_time_id',
                'ht.habit_id',
                'ht.time_slot',
                DB::raw("TIMESTAMP(CONCAT('{$todayYmd}', ' ', ht.notify_time)) as notify_ts"),
            ])
            ->get()
            ->filter(function ($row) use ($now) {
                return Carbon::parse($row->notify_ts)->lessThanOrEqualTo($now);
            })
            ->values();

        if ($dueTimes->isEmpty()) {
            $this->info('scheduled: 0 item(s)');
            return self::SUCCESS;
        }

        $scheduled = 0;

        foreach ($dueTimes as $t) {
            DB::beginTransaction();
            try {
                // 2) 今日の HabitLog を作成（なければ）
                $insertLogSql = "
                    INSERT IGNORE INTO habit_logs
                      (habit_id, user_id, date, time_slot, status, rating, checked_at, note, created_at, updated_at, habit_time_id)
                    SELECT
                      h.id,
                      h.user_id,
                      ?       AS date,
                      ?       AS time_slot,
                      'none'  AS status,
                      0       AS rating,
                      NULL    AS checked_at,
                      NULL    AS note,
                      NOW()   AS created_at,
                      NOW()   AS updated_at,
                      ?       AS habit_time_id
                    FROM habits h
                    WHERE h.id = ?
                    LIMIT 1
                ";
                // [CHANGED] 実際の影響行数を取得
                $insLog = DB::affectingStatement($insertLogSql, [
                    $todayYmd,
                    (int)($t->time_slot ?? 0),
                    (int)$t->habit_time_id,
                    (int)$t->habit_id,
                ]);

                // 生成済み/既存を含め「今日のログ」を取得
                $log = DB::table('habit_logs')
                    ->where('habit_id', (int)$t->habit_id)
                    ->where('date', $todayYmd)
                    ->orderByDesc('id')
                    ->first();

                if (!$log) {
                    throw new \RuntimeException('Failed to ensure today HabitLog.');
                }

                // 3) RemindTask を作成（なければ）
                $notifyTs = Carbon::parse($t->notify_ts)->toDateTimeString();
                $insertTaskSql = "
                    INSERT IGNORE INTO remind_tasks
                      (habit_log_id, parent_task_id, remind_at, reschedule, status, created_at, updated_at)
                    VALUES
                      (?, NULL, ?, NULL, 'pending', NOW(), NOW())
                ";
                // [CHANGED] こちらも影響行数を確認
                $insTask = DB::affectingStatement($insertTaskSql, [
                    (int)$log->id,
                    $notifyTs,
                ]);

                DB::commit();

                // [CHANGED] RemindTask が新規に作られた時だけカウント
                if ($insTask > 0) {
                    $scheduled++;
                }
            } catch (\Throwable $e) {
                DB::rollBack();
                Log::error('[remind:schedule-due] create failed', [
                    'habit_id' => (int)$t->habit_id,
                    'time_slot'=> (int)($t->time_slot ?? 0),
                    'error'    => $e->getMessage(),
                ]);
            }
        }

        $this->info("scheduled: {$scheduled} item(s)");
        return self::SUCCESS;
    }
}