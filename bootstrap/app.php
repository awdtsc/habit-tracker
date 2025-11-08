<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule; // [CHANGED] スケジューラ用
use Illuminate\Support\Facades\Log;

// Sanctum: セッション連動（SPA向け）
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

// API用の401 JSON固定ミドルウェア
use App\Http\Middleware\EnsureApiAuthenticated;

return Application::configure(basePath: dirname(__DIR__))

    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
    )

    // ミドルウェア設定（Laravel 11/12 方式）
    ->withMiddleware(function (Middleware $middleware) {
        /**
         * ✅ 最重要：SPA（例: Vite:5173）からの /api/* を
         *    「stateful（Cookie認証）」として扱う
         */
        $middleware->statefulApi();

        // webグループに Sanctum のセッション連動を付与（/login 後のセッション維持）
        $middleware->appendToGroup('web', AuthenticateSession::class);

        // API 用ミドルウェアの別名（未認証は常に JSON 401 を返す）
        $middleware->alias([
            'auth.api' => EnsureApiAuthenticated::class,
        ]);
    })

    ->withExceptions(function (Exceptions $exceptions) {
        // 必要に応じてハンドラ追加
    })

    // === スケジューラ定義はここに集約（Laravel 11/12 標準） ===
    ->withSchedule(function (Schedule $schedule) {
        /**
         * ✅ 必要最小限：予定時刻到来時の自動生成だけを毎分実行
         *    - HabitLog/RemindTask の自動生成（冪等）
         *    - 送信系（reminders:dispatch）や Heartbeat は一旦停止
         */
        $schedule->command('remind:schedule-due') // [CHANGED]
            ->everyMinute()
            ->withoutOverlapping()
            ->name('remind:schedule-due')
            ->description('Create RemindTasks for due times every minute'); // [CHANGED]
    })

    // ★ クラスベースの Artisan コマンドを明示登録（実在クラスに合わせる）
    ->withCommands([
        \App\Console\Commands\InitDailyHabitLogs::class, // php artisan habits:init-daily
        \App\Console\Commands\DispatchReminders::class,  // php artisan reminders:dispatch
        \App\Console\Commands\RemindScheduleDue::class,  // php artisan remind:schedule-due
    ])

    ->create();