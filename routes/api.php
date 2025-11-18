<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\HabitController;
use App\Http\Controllers\HabitLogController;
use App\Http\Controllers\RemindTaskController;
use App\Http\Controllers\RemindTaskActionController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\TodayController;
use App\Http\Controllers\StatsController;

/*
|--------------------------------------------------------------------------
| API Routes for SPA（Cookie-based Sanctum Auth）
|--------------------------------------------------------------------------
| 方針（確定版）
| - /api/* は絶対に web のリダイレクトに巻き込まない
| - 認証必須は 'auth.api'（未ログイン → 常に JSON 401）
| - /api/user のみ 'auth:sanctum' を使う（セッション認証）
| - 全 API は JSON を返し、リダイレクトは 0%
|--------------------------------------------------------------------------
*/


/*======================================================================
 | 1. Public API（認証不要）
 *=====================================================================*/

Route::get('/health', fn () => ['ok' => true]);

/**
 * GET /api/auth/state
 * SPA 初期ロードで「ログイン中か？」だけを知る
 * ※ middleware:web でセッションクッキーを読む
 */
Route::middleware('web')->get('/auth/state', function (Request $req) {
    $u = $req->user();
    return [
        'authenticated' => (bool) $u,
        'user' => $u ? [
            'id'    => $u->id,
            'name'  => $u->name,
            'email' => $u->email,
        ] : null,
    ];
})->name('api.auth.state');


/*======================================================================
 | 2. /api/user（Sanctum セッション認証）
 *=====================================================================*/

Route::middleware(['web', 'auth:sanctum'])
    ->get('/user', fn (Request $req) => $req->user())
    ->name('api.user');


/*======================================================================
 | 3. Auth Required API（auth.api：未ログインなら JSON 401）
 *=====================================================================*/

Route::middleware(['web', 'auth.api'])->group(function () {

    /*-------------------------------
     | Today API（TodayTab 用）
     *------------------------------*/
    Route::get('/today', [TodayController::class, 'show'])
        ->name('api.today');


    /*-------------------------------
     | Weekly Board API（Week タブ用）
     *------------------------------*/
    Route::get('/weekly-board', [StatsController::class, 'weeklyBoard'])
        ->name('api.weekly-board');


    /*-------------------------------
     | Weekly Logs API（必要な場合のみ）
     | GET /api/logs?start=YYYY-MM-DD&end=YYYY-MM-DD
     *------------------------------*/
    Route::get('/logs', [StatsController::class, 'logs'])
        ->name('api.logs');


    /*-------------------------------
     | 習慣 CRUD（REST）
     *------------------------------*/
    Route::apiResource('habits', HabitController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy'])
        ->names('api.habits');


    /*-------------------------------
     | HabitLog（チェック・評価）
     *------------------------------*/
    Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])
        ->name('api.habit-logs.toggle');

    Route::post('/habit-logs/rate', [HabitLogController::class, 'rate'])
        ->name('api.habit-logs.rate');


    /*-------------------------------
     | Push 購読管理
     *------------------------------*/
    Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store'])
        ->name('api.push.subscriptions.store');

    Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy'])
        ->name('api.push.subscriptions.destroy');


    /*-------------------------------
     | Remind Task（通知タスク）
     *------------------------------*/
    Route::post('/remind-tasks', [RemindTaskController::class, 'store'])
        ->name('api.remind-tasks.store');

    Route::post('/remind-tasks/{task}/done', [RemindTaskActionController::class, 'done'])
        ->middleware('can:done,task')
        ->name('api.remind-tasks.done');

    Route::post('/remind-tasks/{task}/cancel', [RemindTaskActionController::class, 'cancel'])
        ->middleware('can:cancel,task')
        ->name('api.remind-tasks.cancel');

    Route::post('/remind-tasks/{task}/snooze', [RemindTaskController::class, 'snooze'])
        ->middleware('can:snooze,task')
        ->name('api.remind-tasks.snooze');
});