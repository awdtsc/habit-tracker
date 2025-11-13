<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * 明示登録が必要なコマンドがある場合のみ列挙（通常は空でOK）
     * 例：旧コマンド名互換のブリッジを一定期間だけ残すなど
     */
    protected $commands = [
        // \App\Console\Commands\HabitInitDailyBridge::class, // 互換を残すならここに
    ];

    /**
     * スケジュール定義
     *
     * - 既に bootstrap/app.php の withSchedule で登録しているなら
     *   二重起動を避けるためここは実行しない（ENVで切替）
     */
    protected function schedule(Schedule $schedule): void
    {
        // 既定: false（= bootstrap/app.php 側で回す）
        if (!env('RUN_SCHEDULER_IN_KERNEL', false)) {
            return;
        }

        // 予定時刻到来時の RemindTask 生成（冪等）
        $schedule->command('remind:schedule-due')
            ->everyMinute()
            ->timezone('Asia/Tokyo')
            ->withoutOverlapping()
            ->name('remind:schedule-due')
            ->description('Create RemindTasks for due times every minute');

        // 送信期限（due）の RemindTask を送るだけ（新規生成しない）
        $schedule->command('remind:send-due')
            ->everyMinute()
            ->timezone('Asia/Tokyo')
            ->withoutOverlapping()
            ->name('remind:send-due')
            ->description('Send due RemindTasks every minute');

        // 必要なら日次初期化もこちらで（使う場合だけコメント解除）
        // $schedule->command('habits:init-daily')
        //     ->dailyAt('00:00')
        //     ->timezone('Asia/Tokyo')
        //     ->name('habits:init-daily')
        //     ->description('Idempotently create HabitLogs for today');
    }

    /**
     * コマンドのロード
     */
    protected function commands(): void
    {
        // app/Console/Commands 配下の Artisan コマンドを自動登録
        $this->load(__DIR__ . '/Commands');

        // 追加のルーティングベースのコンソール定義があれば
        require base_path('routes/console.php');
    }
}