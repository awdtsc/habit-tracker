<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\RemindTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test; // ★ 追加

class RemindTaskPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function makeTaskFor(User $user): RemindTask
    {
        $habit = Habit::factory()->create(['user_id' => $user->id]);
        $log = HabitLog::factory()->create([
            'user_id'   => $user->id,
            'habit_id'  => $habit->id,
            'status'    => 'none',
            'date'      => now()->toDateString(),
            'time_slot' => 0,
        ]);

        return RemindTask::factory()->create([
            'habit_log_id' => $log->id,
            'status'       => 'pending',
            'remind_at'    => now()->addMinutes(5),
        ]);
    }

    #[Test]
    public function owner_can_snooze()
    {
        /** @var \App\Models\User $owner */
        $owner = User::factory()->createOne();
        $task  = $this->makeTaskFor($owner);

        $res = $this->actingAs($owner)
            ->postJson("/api/reminders/{$task->id}/snooze", ['minutes' => 3]);

        $res->assertOk()
            ->assertJsonPath('task.id', $task->id)
            ->assertJsonPath('task.status', 'pending');
    }

    #[Test]
    public function non_owner_is_forbidden_to_snooze()
    {
        /** @var \App\Models\User $owner */
        $owner = User::factory()->createOne();
        /** @var \App\Models\User $other */
        $other = User::factory()->createOne();
        $task  = $this->makeTaskFor($owner);

        $this->actingAs($other)
            ->postJson("/api/reminders/{$task->id}/snooze", ['minutes' => 3])
            ->assertForbidden();
    }

    #[Test]
    public function non_owner_is_forbidden_to_view()
    {
        /** @var \App\Models\User $owner */
        $owner = User::factory()->createOne();
        /** @var \App\Models\User $other */
        $other = User::factory()->createOne();
        $task  = $this->makeTaskFor($owner);

        $this->actingAs($other)
            ->getJson("/api/remind-tasks/{$task->id}")
            ->assertForbidden();
    }

    #[Test]
    public function owner_can_done_and_cancel_pending_task()
    {
        /** @var \App\Models\User $owner */
        $owner = User::factory()->createOne();
        $task  = $this->makeTaskFor($owner); // pending

        // done
        $this->actingAs($owner)
            ->postJson("/api/reminders/{$task->id}/done")
            ->assertOk()
            ->assertJsonPath('task.status', 'done');

        // pending に戻して cancel
        $task->refresh();
        $task->status = 'pending';
        $task->save();

        $this->actingAs($owner)
            ->postJson("/api/reminders/{$task->id}/cancel")
            ->assertOk()
            ->assertJsonPath('task.status', 'canceled');
    }

    #[Test]
    public function non_owner_is_forbidden_to_done_and_cancel()
    {
        /** @var \App\Models\User $owner */
        $owner = User::factory()->createOne();
        /** @var \App\Models\User $other */
        $other = User::factory()->createOne();
        $task  = $this->makeTaskFor($owner);

        $this->actingAs($other)
            ->postJson("/api/reminders/{$task->id}/done")
            ->assertForbidden();

        $this->actingAs($other)
            ->postJson("/api/reminders/{$task->id}/cancel")
            ->assertForbidden();
    }
}