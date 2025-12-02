<?php

namespace App\Services;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\RemindTask;
use App\Models\HabitTime;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoLogAndRemindService
{
    /**
     * 互換：呼び出し口が run() を前提にしている箇所向け（No-Op）
     */
    public function run(?string $date = null, ?string $now = null): void
    {
        Log::info('[AutoLogAndRemindService] run() called (compat no-op)', [
            'date' => $date, 'now' => $now,
        ]);
    }

    /**
     * 互換：HabitObserver など旧名を呼ぶ箇所向け（No-Op）
     */
    public function initHabitForDate(Habit $habit, ?string $date = null, ?string $now = null): void
    {
        Log::info('[AutoLogAndRemindService] initHabitForDate() called (compat no-op)', [
            'habit_id' => $habit->id, 'date' => $date, 'now' => $now,
        ]);
    }

    /**
     * 「いま時点までに到来した通知時刻」について、
     * HabitLog（status=none）と RemindTask（pending）を冪等的に用意する。
     * 戻り値は新規作成（または確保）した対象数の概算。
     */
    public function runForDueNow(): int
    {
        if (!config('habits.auto_create_log_on_scheduled')) {
            Log::info('[AutoLogAndRemindService] auto_create_log_on_scheduled = false (skip)');
            return 0;
        }

        $tz     = config('habits.timezone', 'Asia/Tokyo');
        $now    = Carbon::now($tz);
        $today  = $now->toDateString();
        $hmsNow = $now->format('H:i:00');

        $count = 0;

        // いま到来済みの HabitTime を拾う（通知時刻あり・当日同時刻以内）
        HabitTime::query()
            ->with(['habit' => fn($q) => $q->with('user')])
            ->whereNotNull('notify_time')
            ->where('notify_time', '<=', $hmsNow)
            ->orderBy('id')
            ->chunkById(200, function ($chunk) use ($today, $tz, &$count) {
                foreach ($chunk as $ht) {
                    $habit = $ht->habit;
                    if (!$habit) {
                        continue;
                    }

                    $slot = (int) ($ht->time_slot ?? 0);
                    if (!$this->isPlannedTodaySlot($habit, $today, $slot)) {
                        // 本日そのスロットが予定外ならスキップ
                        continue;
                    }

                    // 既に達成済みなら RemindTask はスキップ状態で監査だけ
                    $doneAlready = HabitLog::where([
                        'habit_id'  => $habit->id,
                        'date'      => $today,
                        'time_slot' => $slot,
                    ])->whereIn('status', ['done', 'success', 'checked'])->exists();

                    if ($doneAlready) {
                        $this->ensureSkipTask($habit->id, $today, $slot, $tz);
                        continue;
                    }

                    try {
                        DB::transaction(function () use ($habit, $ht, $today, $slot, $tz, &$count) {
                            $logId = $this->ensureHabitLog(
                                (int) $habit->user_id,
                                (int) $habit->id,
                                $today,
                                $slot,
                                (int) $ht->id
                            );

                            $this->ensureRemindTask(
                                $logId,
                                $today,
                                $slot,
                                (string) $ht->notify_time,
                                (int) ($ht->remind_offset ?? 0),
                                $tz
                            );

                            $count++;
                        }, 3); // レース条件に備えて再試行
                    } catch (\Throwable $e) {
                        // ユニーク制約競合などは冪等想定なので WARN ログで継続
                        Log::warning('[AutoLogAndRemindService] ensure* failed (ignored)', [
                            'habit_id'  => $habit->id,
                            'slot'      => $slot,
                            'date'      => $today,
                            'error'     => $e->getMessage(),
                        ]);
                    }
                }
            });

        Log::info('[AutoLogAndRemindService] runForDueNow() finished', [
            'created_or_verified' => $count,
            'now' => $now->toDateTimeString(),
        ]);

        return $count;
    }

    /**
     * HabitLog を（なければ）status=none で作成
     */
    protected function ensureHabitLog(
        int $userId,
        int $habitId,
        string $date,
        int $slot,
        ?int $habitTimeId
    ): int {
        $log = HabitLog::firstOrCreate(
            ['habit_id' => $habitId, 'date' => $date, 'time_slot' => $slot],
            [
                'user_id'       => $userId,
                'status'        => 'none',
                'rating'        => null,
                'note'          => null,
                'habit_time_id' => $habitTimeId,
                'checked_at'    => null,
            ]
        );

        return (int) $log->id;
    }

    /**
     * pending の RemindTask を（なければ）用意
     */
    protected function ensureRemindTask(
        int $habitLogId,
        string $date,
        int $slot,
        string $notifyTime,
        int $offsetMinutes,
        string $tz
    ): void {
        $scheduled = Carbon::parse($date . ' ' . $notifyTime, $tz);
        if ($offsetMinutes) {
            $scheduled = $scheduled->copy()->addMinutes($offsetMinutes);
        }

        RemindTask::firstOrCreate(
            [
                'habit_log_id' => $habitLogId,
                'remind_at'    => $scheduled,
            ],
            [
                'reschedule'   => null,
                'status'       => 'pending',
            ]
        );
    }

    /**
     * 既に達成済みだった場合の「監査用 skipped タスク」を確保
     */
    protected function ensureSkipTask(int $habitId, string $date, int $slot, string $tz): void
    {
        $log = HabitLog::where([
            'habit_id'  => $habitId,
            'date'      => $date,
            'time_slot' => $slot,
        ])->first();

        if (!$log) {
            return;
        }

        $exists = RemindTask::where('habit_log_id', $log->id)->exists();
        if ($exists) {
            return;
        }

        RemindTask::create([
            'habit_log_id' => $log->id,
            'remind_at'    => Carbon::now($tz),
            'reschedule'   => json_encode(['reason' => 'already_done']),
            'status'       => 'skipped',
        ]);
    }

    /**
     * 本日、そのスロットで予定されているかをドメインメソッドに委譲
     */
    protected function isPlannedTodaySlot(Habit $habit, string $today, int $slot): bool
    {
        $date = Carbon::parse($today, config('habits.timezone', 'Asia/Tokyo'));
        return $habit->isScheduledFor($date, $slot);
    }
}