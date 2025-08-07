<?php

use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HabitController;
use App\Http\Controllers\HabitLogController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware(['auth', 'verified'])
    ->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
    Route::post('/habit-logs', [HabitLogController::class, 'store'])->name('habit-logs.store');
    Route::delete('/habits/{habit}', [HabitController::class, 'destroy'])->name('habits.destroy');
    Route::get('/habits/{habit}/edit', [HabitController::class, 'edit'])->name('habits.edit');
    Route::put('/habits/{habit}', [HabitController::class, 'update'])->name('habits.update');
    Route::resource('habits', HabitController::class);
});

require __DIR__.'/auth.php';
