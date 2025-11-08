<?php

namespace App\Observers;

use App\Models\Habit;
use App\Services\DailyInitService;
use Illuminate\Support\Facades\Log;

class HabitObserver
{
    /**
     * 習慣が新規作成されたら：
     * - 当日(JST)分の HabitLog を冪等作成
     * - 同日の RemindTask(pending) を HabitTime ごとに冪等作成
     *
     * ※ 9月方式：過去/未来の区別はせず「当日分」を作る
     *   （送信ジョブ側で scheduled_at<=now の pending を送る）
     */
    public function created(Habit $habit): void
    {
        $date = now('Asia/Tokyo')->toDateString();
        app(DailyInitService::class)->run($date, null, $habit->id);

        Log::info('[HabitObserver] init-daily on create', [
            'habit_id' => $habit->id,
            'date'     => $date,
        ]);
    }

    /**
     * 重要プロパティが変わったら当日分だけ再初期化
     * （冪等なので重複生成の心配なし）
     */
    public function updated(Habit $habit): void
    {
        if ($habit->wasChanged(['days_of_week', 'start_date', 'end_date', 'is_active'])) {
            $date = now('Asia/Tokyo')->toDateString();
            app(DailyInitService::class)->run($date, null, $habit->id);

            Log::info('[HabitObserver] init-daily on update', [
                'habit_id' => $habit->id,
                'date'     => $date,
                'changed'  => $habit->getChanges(),
            ]);
        }
    }
}