<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;

use App\Http\Middleware\EnsureApiAuthenticated;

// === Commands ===
use App\Console\Commands\HabitsInitDailyCommand;  // habits:init-daily（ログ生成のみ）
use App\Console\Commands\RemindSendDueCommand;    // remind:send-due（送信専任）
use App\Console\Commands\RemindScheduleDue;       // remind:schedule-due（今日分タスク生成）

return Application::configure(basePath: dirname(__DIR__))

    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
        health: '/up',
    )

    // Laravel 11/12 方式のミドルウェア設定
    ->withMiddleware(function (Middleware $middleware) {
        // SPA からの /api/* を stateful（Cookie 認証）として扱う
        $middleware->statefulApi();

        // /login 後のセッション維持（Sanctum）
        $middleware->appendToGroup('web', AuthenticateSession::class);

        // API未認証は常に JSON 401
        $middleware->alias([
            'auth.api' => EnsureApiAuthenticated::class,
        ]);
    })

    ->withExceptions(function (Exceptions $exceptions) {
        // 必要に応じてハンドラ追加
    })

    // === スケジューラ ===
    // Windows のタスクスケジューラはそのままでも、
    // フラグで “中身を無効化” できるキルスイッチ方式。
    ->withSchedule(function (Schedule $schedule) {
        $tz = config('app.timezone', 'Asia/Tokyo');

        // config/remind.php を優先し、無ければ .env の SCHEDULE_* を読む
        $enableGenerate = (bool) config('remind.enable_scheduler', env('SCHEDULE_REMIND_GENERATE', false));
        $enableSend     = (bool) config('remind.enable_sender',    env('SCHEDULE_REMIND_SEND',     false));
        $enableInit     = (bool) config('remind.enable_init_daily',env('SCHEDULE_INIT_DAILY',      false));

        // RemindTask 生成（毎分）— when() で完全停止可
        $schedule->command('remind:schedule-due')
            ->everyMinute()
            ->timezone($tz)
            ->withoutOverlapping()
            ->when(fn () => $enableGenerate)
            ->description('Create RemindTasks for due times every minute');

        // RemindTask 送信（毎分）— when() で完全停止可
        $schedule->command('remind:send-due')
            ->everyMinute()
            ->timezone($tz)
            ->withoutOverlapping()
            ->when(fn () => $enableSend)
            ->description('Send due RemindTasks every minute');

        // （任意）日次ログ生成
        $schedule->command('habits:init-daily')
            ->dailyAt('00:00')
            ->timezone($tz)
            ->when(fn () => $enableInit)
            ->description('Idempotently create HabitLogs for today');
    })

    // === Artisan コマンドの明示登録 ===
    ->withCommands([
        HabitsInitDailyCommand::class,
        RemindSendDueCommand::class,
        RemindScheduleDue::class, // 使っていなければ削除可
    ])

    ->create();