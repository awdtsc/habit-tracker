<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Carbon\Carbon;
use App\Models\Habit;
use App\Services\DailyInitService;

class HabitsInitDaily extends Command
{
    /**
     * コマンド署名
     *
     * 例：
     *  php artisan habits:init-daily --date=2025-11-06 --now="2025-11-06 08:00:00" --habit=5
     */
    protected $signature = 'habits:init-daily
                            {--date= : JSTの日付(YYYY-MM-DD)。未指定は今日}
                            {--now=  : JSTの現在時刻(YYYY-MM-DD HH:MM:SS)。未指定は now()}
                            {--habit= : 対象Habit ID（指定時はその1件のみ）}';

    protected $description = 'その日の HabitLog と RemindTask を初期化（JST解釈、DBはUTC保存）';

    public function handle(DailyInitService $svc): int
    {
        $tz   = 'Asia/Tokyo';

        $date = $this->option('date')
            ? Carbon::parse($this->option('date'), $tz)->startOfDay()
            : now($tz)->startOfDay();

        $now  = $this->option('now')
            ? Carbon::parse($this->option('now'), $tz)
            : now($tz);

        $query = Habit::query()->with('times');
        if ($id = $this->option('habit')) {
            $query->whereKey((int)$id);
        }
        $habits = $query->get();

        foreach ($habits as $h) {
            $svc->initHabitForDate($h, $date, $now);
        }

        $this->info("init-daily done for date={$date->toDateString()} now={$now->toDateTimeString()} (JST)");
        return self::SUCCESS;
    }
}