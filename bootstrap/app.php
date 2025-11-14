<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

// Sanctum
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

// Custom Middleware
use App\Http\Middleware\EnsureApiAuthenticated;

// Commands
use App\Console\Commands\HabitsInitDailyCommand;
use App\Console\Commands\RemindSendDueCommand;
use App\Console\Commands\RemindScheduleDue;

return Application::configure(basePath: dirname(__DIR__))

    /* =========================================================
     | Routing
     * =======================================================*/
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
        health: '/up',
    )

    /* =========================================================
     | Middleware（Laravel11/12 方式）
     * =======================================================*/
    ->withMiddleware(function (Middleware $middleware) {

        // --- Sanctum: SPA の Cookie 認証を stateful に扱う ---
        $middleware->statefulApi();

        // --- /login 後の session を Sanctum と同期 ---
        $middleware->appendToGroup('web', AuthenticateSession::class);

        // --- API 専用ミドルウェア（未認証は必ず JSON 401）---
        $middleware->alias([
            'auth.api' => EnsureApiAuthenticated::class,
        ]);
    })

    /* =========================================================
     | Exception Handlers
     * =======================================================*/
    ->withExceptions(function (Exceptions $exceptions) {
        // 必要に応じてハンドラ追加（現状なし）
    })

    /* =========================================================
     | Scheduler（Push/Remind/Habits）
     * =======================================================*/
    ->withSchedule(function (Schedule $schedule) {
        $tz = config('app.timezone', 'Asia/Tokyo');

        // .env or config/remind.php によるキルスイッチ
        $enableGenerate = (bool) config('remind.enable_scheduler', env('SCHEDULE_REMIND_GENERATE', false));
        $enableSend     = (bool) config('remind.enable_sender',    env('SCHEDULE_REMIND_SEND',     false));
        $enableInit     = (bool) config('remind.enable_init_daily',env('SCHEDULE_INIT_DAILY',      false));

        // リマインダー生成（毎分）
        $schedule->command('remind:schedule-due')
            ->everyMinute()->timezone($tz)->withoutOverlapping()
            ->when(fn () => $enableGenerate);

        // リマインダー送信（毎分）
        $schedule->command('remind:send-due')
            ->everyMinute()->timezone($tz)->withoutOverlapping()
            ->when(fn () => $enableSend);

        // 日次ログ（必要時のみ）
        $schedule->command('habits:init-daily')
            ->dailyAt('00:00')->timezone($tz)
            ->when(fn () => $enableInit);
    })

    /* =========================================================
     | Artisan Commands
     * =======================================================*/
    ->withCommands([
        HabitsInitDailyCommand::class,
        RemindSendDueCommand::class,
        RemindScheduleDue::class,
    ])

    ->create();