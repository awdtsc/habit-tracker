<?php

namespace App\Services;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use App\Models\Habit;

/**
 * DailyInitService
 *
 * 役割：
 *  - アプリ側（Observer/Controller/Job/Scheduler）から日次初期化を呼ぶ“窓口”
 *  - 実処理は habits:init-daily（InitDailyHabitLogs）へ委譲
 *  - 単一習慣のみ初期化したい場合は --habit-id で絞り込み
 */
class DailyInitService
{
    /**
     * 全体実行（または一部絞り込み）
     *
     * @param string|null       $date        YYYY-MM-DD（未指定は Asia/Tokyo の今日）
     * @param string|null       $now         YYYY-MM-DD HH:MM:SS（ログ用途）
     * @param int|int[]|null    $habitId     単一または複数の habit_id（省略で全体）
     */
    public function run(?string $date = null, ?string $now = null, int|array|null $habitId = null): void
    {
        $opts = [];
        if ($date) $opts['--date'] = $date;
        if ($now)  $opts['--now']  = $now;

        $ids = is_null($habitId) ? [] : (is_array($habitId) ? $habitId : [$habitId]);
        foreach ($ids as $id) {
            $opts['--habit-id'][] = (int)$id;
        }

        $exit = Artisan::call('habits:init-daily', $opts);

        Log::info('[DailyInitService] delegated habits:init-daily', [
            'date'   => $date,
            'now'    => $now,
            'ids'    => $ids,
            'exit'   => $exit,
            'output' => trim(Artisan::output()),
        ]);
    }

    /**
     * 互換：特定 Habit で呼ばれた場合も、最小変更でコマンドへ委譲。
     * 必要に応じて date/now を合わせて指定可能。
     */
    public function initHabitForDate(Habit $habit, ?string $date = null, ?string $now = null): void
    {
        $this->run($date, $now, $habit->id);
        Log::info('[DailyInitService] initHabitForDate delegated', [
            'habit_id' => $habit->id,
            'date'     => $date,
            'now'      => $now,
        ]);
    }
}