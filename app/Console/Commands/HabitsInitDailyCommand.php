<?php

namespace App\Console\Commands;

use App\Services\DailyInitService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class HabitsInitDailyCommand extends Command
{
    protected $signature = 'habits:init-daily {date? : Target date in JST (YYYY-MM-DD)} {--user= : Limit processing to a specific user ID}';

    protected $description = 'Idempotently generate daily HabitLog rows for scheduled habits.';

    public function __construct(private DailyInitService $dailyInitService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $timezone = config('app.timezone', 'Asia/Tokyo');
        $dateInput = $this->argument('date');
        $date = $dateInput
            ? Carbon::parse($dateInput, $timezone)
            : Carbon::now($timezone);

        $userOption = $this->option('user');
        $userId = is_null($userOption) ? null : (int) $userOption;

        $result = $this->dailyInitService->initForDate($date, $userId);

        $this->info(sprintf(
            'Habits init for %s: %d candidates, %d inserted, %d skipped.',
            $result['date'],
            $result['candidates'],
            $result['inserted'],
            $result['skipped']
        ));

        return self::SUCCESS;
    }
}