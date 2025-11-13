<?php

// database/factories/RemindTaskFactory.php
namespace Database\Factories;

use App\Models\HabitLog;
use App\Models\RemindTask;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

class RemindTaskFactory extends Factory
{
    protected $model = RemindTask::class;

    public function definition(): array
    {
        return [
            'habit_log_id' => HabitLog::factory(),
            'remind_at'    => Carbon::now()->addMinutes(5),
            'reschedule'   => null,        // 例: ['type'=>'preset','value'=>'5m']
            'status'       => 'pending',   // default に合わせる
        ];
    }

    public function pending(): static   { return $this->state(fn() => ['status' => 'pending']); }
    public function sent(): static      { return $this->state(fn() => ['status' => 'sent']); }
    public function cancelled(): static { return $this->state(fn() => ['status' => 'cancelled']); }
    public function skipped(): static   { return $this->state(fn() => ['status' => 'skipped']); }
    public function error(): static     { return $this->state(fn() => ['status' => 'error']); }
}