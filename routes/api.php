<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

use App\Http\Controllers\Api\HabitController;
use App\Http\Controllers\HabitLogController;
use App\Http\Controllers\RemindTaskController;
use App\Http\Controllers\RemindTaskActionController;
use App\Http\Controllers\PushSubscriptionController;

/*
|--------------------------------------------------------------------------
| API Routes (SPA Cookie Auth + Sanctum)
|--------------------------------------------------------------------------
| ポイント：
| - 未認証なら絶対に /login にリダイレクトしない
| - 未認証は常に JSON 401 を返す（auth.api）
| - ただし /api/user は session 認証が必要なので auth:sanctum を使用
| - web ミドルウェアは session を使うために必須
|--------------------------------------------------------------------------
*/


/* =========================================================
 | 1. 認証不要（health / state）
 * =======================================================*/

Route::get('/health', fn () => ['ok' => true]);

Route::get('/auth/state', function (Request $req) {
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



/* =========================================================
 | 2. 特例：/api/user（session 認証のため auth:sanctum）
 * =======================================================*/

Route::middleware(['web', 'auth:sanctum'])->get('/user', function (Request $req) {
    return $req->user();
})->name('api.user');



/* =========================================================
 | 3. 認証必須（auth.api：未認証は 401 JSON）
 * =======================================================*/

Route::middleware(['web', 'auth.api'])->group(function () {

    /* ----- 習慣 CRUD ----- */
    Route::apiResource('habits', HabitController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy'])
        ->names('api.habits');

    /* ----- HabitLog（チェック・評価） ----- */
    Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])
        ->name('api.habit-logs.toggle');

    Route::post('/habit-logs/rate', [HabitLogController::class, 'rate'])
        ->name('api.habit-logs.rate');

    /* ----- Push 購読 ----- */
    Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store'])
        ->name('api.push.subscriptions.store');

    Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy'])
        ->name('api.push.subscriptions.destroy');

    /* ----- Remind Task ----- */
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
