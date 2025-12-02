<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Carbon\Carbon;
use App\Models\User;
use App\Models\Habit;
use App\Models\HabitTime;
use App\Models\HabitLog;
use App\Models\RemindTask;

class RemindScheduleDueTest extends TestCase
{
    use RefreshDatabase;

    public function test_due_time_creates_log_and_pending_task(): void
    {
        config(['habits.timezone' => 'Asia/Tokyo', 'habits.auto_create_log_on_scheduled' => true]);

        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2025-11-06 09:00:00', 'Asia/Tokyo'));

        $habit = Habit::factory()->create([
            'user_id'        => $user->id,
            'frequency_type' => 'daily',
            'start_date'     => '2025-11-01',
            'end_date'       => null,
        ]);

        $ht = HabitTime::query()->create([
            'habit_id'    => $habit->id,
            'time_slot'   => 1,
            'notify_time' => '08:30:00',
        ]);

        $this->artisan('remind:schedule-due')->assertExitCode(0);

        $today = Carbon::now('Asia/Tokyo')->toDateString();

        $this->assertDatabaseHas('habit_logs', [
            'habit_id'  => $habit->id,
            'date'      => $today,
            'time_slot' => 1,
            'status'    => 'none',
        ]);

        $log = HabitLog::where([
            'habit_id'  => $habit->id,
            'date'      => $today,
            'time_slot' => 1,
        ])->first();

        $this->assertNotNull($log);

        $this->assertDatabaseHas('remind_tasks', [
            'habit_log_id' => $log->id,
            'status'       => 'pending',
        ]);
    }

    public function test_idempotent_no_duplicates(): void
    {
        config(['habits.timezone' => 'Asia/Tokyo', 'habits.auto_create_log_on_scheduled' => true]);
        $user = User::factory()->create();
        Carbon::setTestNow(Carbon::parse('2025-11-06 09:00:00', 'Asia/Tokyo'));

        $habit = Habit::factory()->create(['user_id' => $user->id, 'frequency_type' => 'daily']);
        $ht = HabitTime::query()->create([
            'habit_id'    => $habit->id,
            'time_slot'   => 2,
            'notify_time' => '08:00:00',
        ]);

        $this->artisan('remind:schedule-due');
        $this->artisan('remind:schedule-due');

        $today = Carbon::now('Asia/Tokyo')->toDateString();

        $this->assertEquals(1, HabitLog::where([
            'habit_id'  => $habit->id,
            'date'      => $today,
            'time_slot' => 2,
        ])->count());

        $log = HabitLog::where([
            'habit_id'  => $habit->id,
            'date'      => $today,
            'time_slot' => 2,
        ])->first();

        $this->assertNotNull($log);

        $this->assertEquals(1, RemindTask::where([
            'habit_log_id' => $log->id,
        ])->count());
    }
}

