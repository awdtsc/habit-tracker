<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\HabitLogController;

Route::middleware('auth:sanctum')->get('/user', fn(Request $r) => $r->user());

Route::middleware('auth:sanctum')->group(function () {
    // 週ボード（habits / checks / rates）
    Route::get('/weekly-board', [StatsController::class, 'weeklyBoard'])
        ->name('api.weekly-board');

    // 週グラフ（rates）
    Route::get('/achievement/weekly', [StatsController::class, 'weeklyByDay'])
        ->name('api.achievement.weekly');

    // チェックのトグル
    Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])
        ->name('api.habit-logs.toggle');
});