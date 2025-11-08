<?php

// database/factories/HabitLogFactory.php
namespace Database\Factories;

use App\Models\Habit;
use App\Models\HabitLog;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

class HabitLogFactory extends Factory
{
    protected $model = HabitLog::class;

    public function definition(): array
    {
        return [
            'habit_id'      => Habit::factory(),
            'date'          => Carbon::today()->toDateString(), // マイグレーションに合わせて date/datetime どちらでもOK
            'status'        => 'none', // 仕様：'done' or 'none'
            'habit_time_id' => null,   // ある場合に備えた保険
        ];
    }

    public function done(): static
    {
        return $this->state(fn () => ['status' => 'done']);
    }
}