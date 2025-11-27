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
| API Routes for SPA（Sanctum Cookie認証）
|--------------------------------------------------------------------------
| 重要方針:
| - /api/* は絶対にリダイレクトしない
| - auth.api: 未ログインなら常に JSON 401
| - /api/user のみ auth:sanctum
| - 全 API は JSON を返す
|--------------------------------------------------------------------------
*/


/*======================================================================
 | 1. Public API（認証不要）
 *=====================================================================*/

Route::get('/health', fn () => ['ok' => true]);

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
 | 2. /api/user（Sanctum）
 *=====================================================================*/

Route::middleware(['web', 'auth:sanctum'])
    ->get('/user', fn (Request $req) => $req->user())
    ->name('api.user');



/*======================================================================
 | 3. Auth Required API（auth.api）
 *=====================================================================*/

Route::middleware(['web', 'auth.api'])->group(function () {

    /*----------------------------------
     | Today API
     *---------------------------------*/
    Route::get('/today', [TodayController::class, 'show'])
        ->name('api.today');


    /*----------------------------------
     | Weekly Board API
     *---------------------------------*/
    Route::get('/weekly-board', [StatsController::class, 'weeklyBoard'])
        ->name('api.weekly-board');


    /*----------------------------------
     | Habit Logs（週タブ用）
     | GET /api/habit-logs?start=&end=
     *---------------------------------*/
    Route::get('/habit-logs', [HabitLogController::class, 'index'])
        ->name('api.habit-logs.index');


    /*----------------------------------
     | Habit CRUD
     *---------------------------------*/
    Route::apiResource('habits', HabitController::class)
        ->only(['index','store','show','update','destroy'])
        ->names('api.habits');


    /*----------------------------------
     | ★ HabitLog toggle / rate（Today用）
     *---------------------------------*/
    Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])
        ->name('api.habit-logs.toggle');

    Route::post('/habit-logs/rate', [HabitLogController::class, 'rate'])
        ->name('api.habit-logs.rate');


    /*----------------------------------
     | Push 購読
     *---------------------------------*/
    Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy']);


    /*----------------------------------
     | Remind Task
     *---------------------------------*/
    Route::post('/remind-tasks', [RemindTaskController::class, 'store']);

    Route::post('/remind-tasks/{task}/done', [RemindTaskActionController::class, 'done'])
        ->middleware('can:done,task');

    Route::post('/remind-tasks/{task}/cancel', [RemindTaskActionController::class, 'cancel'])
        ->middleware('can:cancel,task');

    Route::post('/remind-tasks/{task}/snooze', [RemindTaskController::class, 'snooze'])
        ->middleware('can:snooze,task');
});