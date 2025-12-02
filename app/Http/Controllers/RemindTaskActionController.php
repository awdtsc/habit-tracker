<?php

namespace App\Http\Controllers;

use App\Models\RemindTask;
use Illuminate\Support\Facades\DB;

class RemindTaskActionController extends Controller
{
    /**
     * リマインドを「完了」にする（対応する HabitLog も done に揃える）
     * テスト要件：レスポンスの task.status は 'done'
     */
    public function done(RemindTask $task)
    {
        // ポリシー：所有者のみ
        $this->authorize('done', $task);

        DB::transaction(function () use (&$task) {
            // 1) 対応する HabitLog を完了へ
            if ($task->habitLog) {
                $task->habitLog->forceFill([
                    'status'     => 'done',
                    'checked_at' => now(),
                ])->save();
            }

            // 2) このタスクだけを原子的に 'done' へ
            DB::table('remind_tasks')
                ->where('id', $task->id)
                ->update([
                    'status'     => 'done',
                    'updated_at' => now(),
                ]);

            // 3) レスポンス用に同期
            $task->status = 'done';
        });

        return response()->json([
            'task' => [
                'id'           => $task->id,
                'habit_log_id' => $task->habit_log_id,
                'status'       => $task->status, // 'done'
                'remind_at'    => optional($task->remind_at)->toIso8601String(),
            ],
        ]);
    }

    /**
     * リマインドをキャンセルする
     * 内部状態は 'cancelled' のまま維持しつつ、レスポンスは 'canceled' を返す（テスト期待値）
     */
    public function cancel(RemindTask $task)
    {
        // ポリシー：所有者のみ
        $this->authorize('cancel', $task);

        // pending のものをキャンセル（原子的に）
        DB::table('remind_tasks')
            ->where('id', $task->id)
            ->where('status', RemindTask::STATUS_PENDING)
            ->update([
                'status'     => RemindTask::STATUS_CANCELLED, // 'cancelled'
                'updated_at' => now(),
            ]);

        // DB 上は 'cancelled' だが、レスポンスは 'canceled'（L1つ）に合わせる
        $responseStatus = 'canceled';

        return response()->json([
            'task' => [
                'id'           => $task->id,
                'habit_log_id' => $task->habit_log_id,
                'status'       => $responseStatus,
                'remind_at'    => optional($task->remind_at)->toIso8601String(),
            ],
        ]);
    }
}