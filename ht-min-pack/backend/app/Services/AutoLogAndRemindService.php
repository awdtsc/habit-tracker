<?php

namespace App\Services;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\RemindTask;
use App\Models\HabitTime;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AutoLogAndRemindService
{
    public function runForDueNow(): int
    {
        if (!config('habits.auto_create_log_on_scheduled')) return 0;

        $tz = config('habits.timezone', 'Asia/Tokyo');
        $now = Carbon::now($tz);
        $today = $now->toDateString();

        // Pick HabitTime with notify_time <= now (same-day) and not null
        $targets = HabitTime::query()
            ->with(['habit' => function($q){ $q->with('user'); }])
            ->whereNotNull('notify_time')
            ->where('notify_time', '<=', $now->format('H:i:00'))
            ->get();

        $count = 0;

        foreach ($targets as $ht) {
            $habit = $ht->habit;
            if (!$habit) continue;
            $userId = (int) $habit->user_id;

            // Check if habit planned for today in this slot
            if (!$this->isPlannedTodaySlot($habit, $today, (int)($ht->time_slot ?? 0))) continue;

            $slot = (int)($ht->time_slot ?? 0);

            // If the log exists and already done/success/checked, skip creating pending and leave a skipped audit
            $doneAlready = HabitLog::where([
                'habit_id'  => $habit->id,
                'date'      => $today,
                'time_slot' => $slot,
            ])->whereIn('status', ['done','success','checked'])->exists();
            if ($doneAlready) {
                $this->ensureSkipTask($habit->id, $today, $slot, $tz);
                continue;
            }

            DB::transaction(function () use ($userId, $habit, $ht, $today, $slot, $tz, &$count) {
                // Ensure habit_log exists (status=none)
                $logId = $this->ensureHabitLog($userId, $habit->id, $today, $slot, $ht->id);

                // Ensure pending remind_tasks exists for scheduled time (idempotent via unique)
                $this->ensureRemindTask($logId, $today, $slot, $ht->notify_time, (int)($ht->remind_offset ?? 0), $tz);

                $count++;
            });
        }

        return $count;
    }

    protected function ensureHabitLog(int $userId, int $habitId, string $date, int $slot, ?int $habitTimeId): int
    {
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

    protected function ensureRemindTask(
        int $habitLogId,
        string $date,
        int $slot,
        string $notifyTime,
        int $offsetMinutes,
        string $tz
    ): void {
        // Compose scheduled time from date + notify_time (+ offset)
        $scheduled = Carbon::parse($date.' '.$notifyTime, $tz);
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

    protected function ensureSkipTask(int $habitId, string $date, int $slot, string $tz): void
    {
        // If there is an existing habit_log, add one skipped task only if none exists at around now
        $log = HabitLog::where([
            'habit_id'  => $habitId,
            'date'      => $date,
            'time_slot' => $slot,
        ])->first();

        if (!$log) return;

        $now = Carbon::now($tz);

        $exists = RemindTask::where('habit_log_id', $log->id)->exists();
        if (!$exists) {
            RemindTask::create([
                'habit_log_id' => $log->id,
                'remind_at'    => $now,
                'reschedule'   => json_encode(['reason' => 'already_done']),
                'status'       => 'skipped',
            ]);
        }
    }

    protected function isPlannedTodaySlot(Habit $habit, string $today, int $slot): bool
    {
        $date = Carbon::parse($today, config('habits.timezone', 'Asia/Tokyo'));
        return $habit->isScheduledFor($date, $slot);
    }
}

