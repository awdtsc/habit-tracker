<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\RemindTask;

/**
 * habits:init-daily-legacy
 *
 * 「9月方式（レガシー）」：
 *  1) 指定日の HabitLog を不足分だけ作成（1習慣1日1件, 冪等・time_slot=0）
 *  2) HabitTime をもとに同日の RemindTask(pending, remind_at=JST) を不足分だけ作成（冪等）
 *
 * ※ 新型は HabitsInitDailyCommand（`habits:init-daily {date?} [--user=]`）。本コマンドは互換目的のみ。
 */
class InitDailyHabitLogsLegacy extends Command
{
    protected $signature = 'habits:init-daily-legacy
                            {--date= : target date YYYY-MM-DD (JST, default=today)}
                            {--now= : reference time YYYY-MM-DD HH:MM:SS (JST, for log only)}
                            {--habit-id=* : target habit ids (repeatable)}
                            {--dry-run : simulate without insert/update}';

    protected $description = '[LEGACY] September mode: Create daily HabitLog (slot=0) and same-day RemindTask(pending) idempotently';

    /** アプリ標準TZ（保存・比較はこのローカル基準で扱う想定） */
    private const APP_TZ = 'Asia/Tokyo';

    /** notify_time が無い場合のスロット既定時刻 */
    private const SLOT_DEFAULT = [
        0 => '09:00:00', // anytime
        1 => '08:00:00', // morning
        2 => '12:30:00', // noon
        3 => '18:00:00', // evening
        4 => '22:00:00', // night
    ];

    public function handle(): int
    {
        $this->warn('[LEGACY] This command is deprecated. Use: php artisan habits:init-daily {date?} [--user=]');

        $tz  = self::APP_TZ;
        $now = $this->option('now')
            ? Carbon::parse($this->option('now'), $tz)
            : now($tz);

        $dateTz = $this->option('date')
            ? Carbon::parse($this->option('date'), $tz)->startOfDay()
            : now($tz)->startOfDay();

        $filterIds = array_values(array_filter(array_map('intval', (array)$this->option('habit-id'))));
        $dryRun    = (bool)$this->option('dry-run');

        $this->info(sprintf(
            '[init-daily-legacy] date=%s now=%s (tz=%s) dryRun=%s',
            $dateTz->toDateString(), $now->toDateTimeString(), $tz, $dryRun ? 'yes' : 'no'
        ));

        $stats = (object)[
            'logs_created'        => 0,
            'logs_existing'       => 0,
            'tasks_created'       => 0,
            'tasks_existing'      => 0,
            'skipped_notplanned'  => 0,
            'skipped_notimed'     => 0,
        ];

        $habitsQ = Habit::query()
            ->with('times')
            ->when($this->hasCol(Habit::query(), 'archived'), function ($q) {
                $q->where('archived', false);
            })
            ->when($this->hasCol(Habit::query(), 'start_date'), function ($q) use ($dateTz) {
                $q->where(function ($qq) use ($dateTz) {
                    $qq->whereNull('start_date')
                       ->orWhere('start_date', '<=', $dateTz->toDateString());
                });
            })
            ->when($this->hasCol(Habit::query(), 'end_date'), function ($q) use ($dateTz) {
                $q->where(function ($qq) use ($dateTz) {
                    $qq->whereNull('end_date')
                       ->orWhere('end_date', '>=', $dateTz->toDateString());
                });
            })
            ->when(!empty($filterIds), function ($q) use ($filterIds) {
                $q->whereIn('id', $filterIds);
            });

        $habitsQ->chunkById(500, function ($habits) use ($dateTz, $tz, $dryRun, $stats) {
            /** @var Habit $habit */
            foreach ($habits as $habit) {
                $planned = method_exists($habit, 'isScheduledFor')
                    ? (bool)$habit->isScheduledFor($dateTz, null)
                    : $this->isHabitPlannedForDate($habit, $dateTz);

                if (!$planned) {
                    $stats->skipped_notplanned++;
                    continue;
                }

                [$log, $created] = $this->ensureDailyHabitLog($habit, $dateTz, $dryRun);
                $created ? $stats->logs_created++ : $stats->logs_existing++;

                $times = $habit->times ?? collect();
                if ($times->isEmpty()) {
                    $stats->skipped_notimed++;
                    continue;
                }

                foreach ($times as $ht) {
                    $timeStr  = $this->resolveNotifyTime($ht->notify_time ?? null, (int)($ht->time_slot ?? 0));
                    $remindAt = Carbon::parse($dateTz->toDateString() . ' ' . $timeStr, $tz)->toDateTimeString();

                    if ($dryRun) {
                        $this->line(sprintf(
                            '[DRY] RemindTask INSERT: log#%s at %s status=pending',
                            $log?->id ?? 'null', $remindAt
                        ));
                        $stats->tasks_created++;
                        continue;
                    }

                    $ins = DB::table((new RemindTask())->getTable())->insertOrIgnore([
                        'habit_log_id' => $log->id,
                        'remind_at'    => $remindAt,
                        'status'       => defined(RemindTask::class.'::STATUS_PENDING')
                                            ? RemindTask::STATUS_PENDING
                                            : 'pending',
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);

                    if ($ins === 1) {
                        $stats->tasks_created++;
                    } else {
                        $stats->tasks_existing++;
                    }
                }
            }
        });

        $this->info('------------------------------------------');
        $this->info("HabitLog  created : {$stats->logs_created}");
        $this->info("HabitLog  existed : {$stats->logs_existing}");
        $this->info("RemindTask created: {$stats->tasks_created}");
        $this->info("RemindTask existed: {$stats->tasks_existing}");
        $this->info("Skipped not planned: {$stats->skipped_notplanned}");
        $this->info("Skipped no times  : {$stats->skipped_notimed}");

        Log::info('habits:init-daily-legacy done', (array)$stats);
        return self::SUCCESS;
    }

    private function ensureDailyHabitLog(Habit $habit, Carbon $dateTz, bool $dryRun): array
    {
        $date = $dateTz->toDateString();

        $existing = HabitLog::query()
            ->where('habit_id', $habit->id)
            ->where('date', $date)
            ->first();

        if ($existing) {
            return [$existing, false];
        }

        if ($dryRun) {
            $this->line(sprintf('[DRY] HabitLog INSERT: habit#%d date=%s status=none', $habit->id, $date));
            $fake = new HabitLog([
                'habit_id' => $habit->id,
                'user_id'  => $habit->user_id ?? null,
                'date'     => $date,
                'status'   => 'none',
            ]);
            $fake->id = -1;
            return [$fake, true];
        }

        $log = HabitLog::firstOrCreate(
            ['habit_id' => $habit->id, 'date' => $date],
            [
                'user_id'       => $habit->user_id,
                'time_slot'     => 0,          // 日単位ログ（終日）
                'status'        => 'none',
                'rating'        => 0,
                'checked_at'    => null,
                'note'          => null,
                'habit_time_id' => null,       // 1日1件のためNULL
            ]
        );

        return [$log, true];
    }

    private function resolveNotifyTime(?string $notifyTime, int $slot): string
    {
        if (is_string($notifyTime) && preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $notifyTime)) {
            return strlen($notifyTime) === 5 ? $notifyTime . ':00' : $notifyTime;
        }
        return self::SLOT_DEFAULT[$slot] ?? self::SLOT_DEFAULT[0];
    }

    private function isHabitPlannedForDate(Habit $habit, Carbon $dateTz): bool
    {
        $date = $dateTz->toDateString();

        if ($this->hasCol(Habit::query(), 'archived') && (bool)$habit->archived === true) {
            return false;
        }
        if ($this->hasCol(Habit::query(), 'start_date') && $habit->start_date && $habit->start_date > $date) {
            return false;
        }
        if ($this->hasCol(Habit::query(), 'end_date') && $habit->end_date && $habit->end_date < $date) {
            return false;
        }

        // 0=Sun..6=Sat（ビットマスク互換用）。ISO対応はモデル実装を優先する設計。
        $weekday = (int)$dateTz->dayOfWeek;

        if ($this->hasCol(Habit::query(), 'days_of_week')) {
            $dowField = $habit->days_of_week;

            if (is_array($dowField)) {
                return in_array($weekday, array_map('intval', $dowField), true);
            }

            if (is_string($dowField) && preg_match('/^\s*\d(?:\s*,\s*\d)*\s*$/', $dowField)) {
                $arr = array_map('intval', array_map('trim', explode(',', $dowField)));
                return in_array($weekday, $arr, true);
            }

            if (is_numeric($dowField)) {
                $mask = (int)$dowField;
                return (($mask >> $weekday) & 1) === 1;
            }
        }

        // 定義なしは毎日扱い
        return true;
    }

    private function hasCol($query, string $column): bool
    {
        try {
            $table = $query->getModel()->getTable();
            static $cache = [];
            if (!isset($cache[$table])) {
                $cols = DB::getSchemaBuilder()->getColumnListing($table);
                $cache[$table] = array_flip($cols);
            }
            return isset($cache[$table][$column]);
        } catch (\Throwable $e) {
            return false;
        }
    }
}