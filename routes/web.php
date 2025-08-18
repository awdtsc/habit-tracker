<?php

use App\Http\Controllers\{ProfileController, DashboardController, HabitController, HabitLogController, StatsController};
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'));

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth','verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    // プロフィール
    Route::get('/profile', [ProfileController::class,'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class,'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class,'destroy'])->name('profile.destroy');

    // 習慣 CRUD（従来のweb）
    Route::resource('habits', HabitController::class);

    // === Vue が叩く API は /api/* に統一 ===
    Route::prefix('api')->as('api.')->group(function () {
        Route::get('/weekly-board', [StatsController::class, 'weeklyBoard'])->name('weekly-board');
        Route::post('/habit-logs/toggle', [HabitLogController::class, 'toggle'])->name('habit-logs.toggle');

        // 使っていなければ下行は丸ごと削除してOK
        Route::get('/achievement/weekly', [StatsController::class, 'weeklyByDay'])->name('achievement.weekly');
    });
});

require __DIR__.'/auth.php';