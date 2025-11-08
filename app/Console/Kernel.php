<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Artisan コマンドを明示登録（必要に応じて）
     */
    protected $commands = [
        \App\Console\Commands\InitDailyHabitLogs::class,     // 互換のため残置（実行はしない）
        \App\Console\Commands\SendHabitReminders::class,     // 将来復帰用（スケジュールは無効）
        \App\Console\Commands\DispatchReminders::class,      // 将来復帰用（スケジュールは無効）
        \App\Console\Commands\RemindScheduleDue::class,      // 有効コマンド
    ];

    /**
     * スケジュール定義
     *
     * ✅ いまは AutoLogAndRemindService（remind:schedule-due）だけ回す。
     * ❌ Heartbeat / reminders:dispatch / habits:init-daily は無効化。
     */
    protected function schedule(Schedule $schedule): void
    {
        // --- 無効化: Heartbeat（開発ログ） ---
        // $schedule->call(fn () => \Log::info('[Heartbeat] alive'))
        //     ->everyMinute()
        //     ->withoutOverlapping();

        // --- 無効化: 通知送出 ---
        // $schedule->command('reminders:dispatch', ['--limit' => 200])
        //     ->everyMinute()
        //     ->withoutOverlapping();

        // --- 無効化: 旧初期化（今はNo-Op互換コマンド） ---
        // $schedule->command('habits:init-daily', ['--today'])
        //     ->dailyAt('14:12');

        // --- 有効: 予定時刻到来時の自動生成（冪等） ---
        $schedule->command('remind:schedule-due')             // [CHANGED]
            ->everyMinute()                                   // [CHANGED]
            ->withoutOverlapping();                           // [CHANGED]
    }

    /**
     * ルートコンソールのロード
     */
    protected function commands(): void
    {
        // app/Console/Commands 配下のコマンドをロード
        $this->load(__DIR__ . '/Commands');

        // routes/console.php をロード（※ここではスケジュール定義しない）
        require base_path('routes/console.php');
    }
}