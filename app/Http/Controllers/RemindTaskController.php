<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\RemindTask;
use App\Models\HabitLog;

class RemindTaskController extends Controller
{
    /**
     * リマインドタスクを作成（既存 pending があれば更新）
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'habit_log_id'   => ['required','integer','exists:habit_logs,id'],
            'parent_task_id' => ['nullable','integer','exists:remind_tasks,id'],
            'preset'         => ['nullable','in:5m,10m,1h,custom'],
            'minutes'        => ['nullable','integer','min:1','max:1440'],
        ]);

        // 所有者チェック（HabitLog 経由）
        $log = HabitLog::with('habit')->findOrFail($data['habit_log_id']);
        abort_unless($log->habit && $log->habit->user_id === Auth::id(), 403);

        // スヌーズ分数の決定
        $preset  = $data['preset'] ?? '5m';
        $minutes = match ($preset) {
            '5m'     => 5,
            '10m'    => 10,
            '1h'     => 60,
            'custom' => (int)($data['minutes'] ?? 5),
            default  => 5,
        };

        $remindAt = now()->addMinutes($minutes)->addSeconds(5);

        $existing = false;
        $task = DB::transaction(function () use ($log, $remindAt, $preset, $minutes, $data, &$existing) {
            $current = RemindTask::where('habit_log_id', $log->id)
                ->where('status', RemindTask::STATUS_PENDING)
                ->lockForUpdate()
                ->first();

            if ($current) {
                $current->update([
                    'remind_at'  => $remindAt,
                    'reschedule' => [
                        'preset'  => $preset,
                        'minutes' => $minutes,
                        'at'      => now()->toIso8601String(),
                    ],
                ]);
                $existing = true;
                return $current;
            }

            $existing = false;
            return RemindTask::create([
                'habit_log_id'   => $log->id,
                'parent_task_id' => $data['parent_task_id'] ?? null,
                'remind_at'      => $remindAt,
                'status'         => RemindTask::STATUS_PENDING,
                'reschedule'     => [
                    'preset'  => $preset,
                    'minutes' => $minutes,
                    'at'      => now()->toIso8601String(),
                ],
            ]);
        });

        return response()->json([
            'ok'   => true,
            'task' => [
                'id'             => $task->id,
                'habit_log_id'   => $task->habit_log_id,
                'parent_task_id' => $task->parent_task_id,
                'remind_at'      => optional($task->remind_at)->toIso8601String(),
                'status'         => $task->status,
            ],
        ], $existing ? 200 : 201);
    }

    /**
     * タスク表示（所有者のみ）
     */
    public function show(RemindTask $task)
    {
        $this->authorize('view', $task);

        $task->load('habitLog.habit');

        return response()->json([
            'task' => [
                'id'           => $task->id,
                'habit_log_id' => $task->habit_log_id,
                'status'       => $task->status,
                'remind_at'    => optional($task->remind_at)->toIso8601String(),
            ],
        ]);
    }

    /**
     * 習慣ごとの最新 pending を取得（所有者のみ）
     */
    public function latestPendingByHabit(Request $request)
    {
        $validated = $request->validate([
            'habit_id' => ['required','integer'],
        ]);

        // 所有者チェック
        $habit = \App\Models\Habit::query()
            ->where('id', $validated['habit_id'])
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $logIds = HabitLog::query()
            ->where('habit_id', $habit->id)
            ->where('user_id', $habit->user_id)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->limit(20)
            ->pluck('id');

        if ($logIds->isEmpty()) {
            return response()->json(['task' => null]);
        }

        $task = RemindTask::query()
            ->whereIn('habit_log_id', $logIds)
            ->where('status', RemindTask::STATUS_PENDING)
            ->orderByDesc('remind_at')
            ->orderByDesc('id')
            ->first();

        if (!$task) {
            return response()->json(['task' => null]);
        }

        return response()->json([
            'task' => [
                'id'           => $task->id,
                'habit_log_id' => $task->habit_log_id,
                'status'       => $task->status,
                'remind_at'    => optional($task->remind_at)->toIso8601String(),
            ],
        ]);
    }

    /**
     * スヌーズ（所有者のみ / テストは非オーナー403を期待）
     */
    public function snooze(Request $request, RemindTask $task)
    {
        // ★ Policy：'snooze' を使う（'update'だとポリシーが走らない）
        $this->authorize('snooze', $task);

        $validated = $request->validate([
            'minutes'   => ['nullable','integer','min:1','max:10080'],
            'remind_at' => ['nullable','date'],
        ]);

        if (!empty($validated['remind_at'])) {
            $task->remind_at = \Illuminate\Support\Carbon::parse($validated['remind_at']);
        } else {
            $minutes = (int)($validated['minutes'] ?? 5);
            $task->remind_at = now()->addMinutes($minutes);
            $validated['minutes'] = $minutes;
        }

        // 再送対象に戻す
        $task->status = RemindTask::STATUS_PENDING;

        // スヌーズ履歴（JSON）
        $task->reschedule = array_merge($task->reschedule ?? [], [
            'last_snooze_minutes' => $validated['minutes'] ?? null,
            'last_snoozed_at'     => now()->toIso8601String(),
        ]);

        $task->save();

        return response()->json([
            'task' => [
                'id'           => $task->id,
                'habit_log_id' => $task->habit_log_id,
                'remind_at'    => optional($task->remind_at)->toIso8601String(),
                'status'       => $task->status,
            ],
        ]);
    }
}