<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

use App\Http\Controllers\StatsController;
use App\Http\Controllers\HabitLogController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\RemindTaskActionController;
use App\Http\Controllers\RemindTaskController;
use App\Http\Controllers\Api\HabitController as ApiHabitController;
use App\Http\Controllers\HabitInitController;
use App\Http\Controllers\TodayController;
use App\Http\Controllers\Api\PushDebugController;

use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;

/**
 * routes/api.php
 *
 * 方針（開発をまず安定させる版）:
 * - SPA の Cookie 認証を素直に通すため、認証は `auth:sanctum` を使用
 *   （以前の custom middleware 'auth.api' は一旦休止。戻す場合は alias 登録必須）
 * - API はすべて JSON を返す
 */

/* =========================================================
 | 1. 認証不要 API
 * =======================================================*/

// ヘルスチェック
Route::get('/health', fn () => response()->json(['ok' => true]));

// SPA 初期問い合わせ（未ログインでも 200）
Route::get('/auth/state', function (Request $request) {
    $user = $request->user(); // Sanctum の stateful 判定で拾える
    return response()->json([
        'authenticated' => (bool) $user,
        'user' => $user ? [
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
        ] : null,
    ]);
})->name('api.auth.state');

// ローカル限定のデバッグ系
if (app()->environment('local')) {
    Route::get('/_debug/session', function (Request $r) {
        return response()->json([
            'cookie_name'        => config('session.cookie'),
            'has_session_cookie' => $r->hasCookie(config('session.cookie')),
            'cookie_from_req'    => $r->cookie(config('session.cookie')),
            'cookies'            => $r->cookies->all(),
        ]);
    });

    Route::get('/_debug/auth', function (Request $request) {
        return response()->json([
            'request_user' => $request->user(),
            'cookies'      => $request->cookies->all(),
        ]);
    });

    // ルート実態の可視化
    Route::get('/_trace', function (Request $r) {
        $route = $r->route();
        return response()->json([
            'path'         => $r->path(),
            'uri'          => optional($route)->uri(),
            'route_name'   => optional($route)->getName(),
            'expectsJson'  => $r->expectsJson(),
            'accept'       => $r->header('Accept'),
            'is_api_star'  => $r->is('api/*'),
            'route_mw'     => optional($route)->gatherMiddleware(),
        ]);
    })->name('api._trace');

    // 開発中の互換（※本番では無効にする）
    Route::post('/save-subscription', [PushSubscriptionController::class, 'store'])
        ->name('api.push.save-subscription.local');

    Route::post('/push/test-public', [PushSubscriptionController::class, 'test'])
        ->middleware('throttle:10,1')
        ->name('api.push.test-public.local');
}

/* =========================================================
 | 2. 認証必須 API（auth:sanctum）
 * =======================================================*/

Route::middleware('auth:sanctum')->group(function () {

    // 現在のログインユーザー
    Route::get('/user', fn (Request $request) => $request->user())->name('api.user');

    // 習慣 CRUD（SPA 用）
    Route::apiResource('habits', ApiHabitController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy'])
        ->names([
            'index'   => 'api.habits.index',
            'store'   => 'api.habits.store',
            'show'    => 'api.habits.show',
            'update'  => 'api.habits.update',
            'destroy' => 'api.habits.destroy',
        ]);

    // 今日ぶん初期化
    Route::post('/habits/{habit}/init-today', [HabitInitController::class, 'initToday'])
        ->whereNumber('habit')
        ->name('api.habits.init-today');

    Route::post('/habits/init-today', [HabitInitController::class, 'initTodayForMe'])
        ->name('api.habits.init-today-for-me');

    // Today 集約API
    Route::get('/today', [TodayController::class, 'show'])
        ->name('api.today');

    // 統計 / 週ボード
    Route::get('/weekly-board', [StatsController::class, 'weeklyBoard'])
        ->name('api.weekly-board');

    Route::get('/achievement/weekly', [StatsController::class, 'weeklyByDay'])
        ->name('api.achievement.weekly');

    // チェックのトグル
    Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])
        ->name('api.habit-logs.toggle');

    /* ---------------- Push 購読API（morphMany: users -> push_subscriptions） ---------------- */

    // 推奨: RESTful 形
    Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store'])
        ->name('api.push.subscriptions.store');

    Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy'])
        ->name('api.push.subscriptions.destroy');

    // 互換（既存フロントが使っている場合のため残す）
    Route::post('/push/subscribe', [PushSubscriptionController::class, 'store'])
        ->name('api.push.subscribe'); // alias

    Route::delete('/push/unsubscribe', [PushSubscriptionController::class, 'destroy'])
        ->name('api.push.unsubscribe'); // alias

    // テスト送信（本番では無効化を推奨）
    Route::post('/push/test', [PushSubscriptionController::class, 'test'])
        ->middleware('throttle:10,1')
        ->name('api.push.test');

    // 任意の Push デバッグ（必要なら Gate/Policy）
    Route::post('/push/debug', [PushDebugController::class, 'send'])
        ->name('api.push.debug');

    /* ---------------- リマインダー操作 ---------------- */

    Route::post('/reminders/{task}/done', [RemindTaskActionController::class, 'done'])
        ->whereNumber('task')
        ->middleware('can:done,task')
        ->name('api.reminders.done');

    Route::post('/reminders/{task}/cancel', [RemindTaskActionController::class, 'cancel'])
        ->whereNumber('task')
        ->middleware('can:cancel,task')
        ->name('api.reminders.cancel');

    Route::post('/reminders/{task}/snooze', [RemindTaskController::class, 'snooze'])
        ->whereNumber('task')
        ->middleware('can:snooze,task')
        ->name('api.reminders.snooze');

    /* ---------------- チェック履歴 取得（期間スキャン） ---------------- */

    Route::get('/habit-logs', function (Request $request) {
        $userId = $request->user()->id;
        $start  = $request->query('start');
        $end    = $request->query('end');

        $startDate = Carbon::parse($start ?? Carbon::today())->startOfDay();
        $endDate   = Carbon::parse($end ?? Carbon::today())->startOfDay();

        $habits = Habit::where('user_id', $userId)->get();
        $result = [];

        for ($d = $startDate->copy(); $d->lte($endDate); $d->addDay()) {
            foreach ($habits as $habit) {
                $log = HabitLog::where('user_id', $userId)
                    ->where('habit_id', $habit->id)
                    ->whereDate('date', $d->toDateString())
                    ->where('time_slot', $habit->time_slot ?? 0)
                    ->first();

                if ($log) {
                    $result[] = [
                        'habit_id'   => $log->habit_id,
                        'date'       => $log->date->toDateString(),
                        'time_slot'  => $log->time_slot,
                        'status'     => $log->status,
                        'rating'     => $log->rating,
                        'updated_at' => $log->updated_at,
                    ];
                } else {
                    $result[] = [
                        'habit_id'   => $habit->id,
                        'date'       => $d->toDateString(),
                        'time_slot'  => $habit->time_slot ?? 0,
                        'status'     => 'none',
                        'rating'     => $habit->evaluation_type === 'self' ? 0 : null,
                        'updated_at' => null,
                    ];
                }
            }
        }

        return response()->json(['logs' => $result]);
    })->name('api.habit-logs.index');
});