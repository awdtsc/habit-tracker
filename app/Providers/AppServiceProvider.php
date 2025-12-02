<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

// 既存の Observer（作成済み想定）
use App\Models\Habit;
use App\Observers\HabitObserver;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 習慣作成時：今日分のログを作り、未来時刻なら当日通知も作成
        Habit::observe(HabitObserver::class);

        // HabitTimeObserver は未作成でもエラーにしない（存在する時だけ有効化）
        if (class_exists('App\\Models\\HabitTime') && class_exists('App\\Observers\\HabitTimeObserver')) {
            \App\Models\HabitTime::observe('App\\Observers\\HabitTimeObserver');
        }
    }
}