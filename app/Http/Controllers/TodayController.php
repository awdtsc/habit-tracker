<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;

class TodayController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        // ----------------------------------------------------
        // タイムゾーン
        // ----------------------------------------------------
        $tz    = $user->timezone ?? config('app.timezone', 'Asia/Tokyo');
        $today = Carbon::now($tz)->startOfDay();
        $now   = Carbon::now($tz);

        $dateStr = $today->toDateString();

        // ----------------------------------------------------
        // 今日の Habit と HabitLog を読み込む
        // ----------------------------------------------------
        $habits = Habit::where('user_id', $user->id)
            ->orderBy('id')
            ->get();

        // 今日の logs（date = today）を1回のクエリで取得（最適）
        $logs = HabitLog::where('user_id', $user->id)
            ->whereDate('date', $dateStr)
            ->orderByDesc('id')
            ->get()
            ->groupBy('habit_id');

        $items = [];
        $doneCount = 0;

        // ----------------------------------------------------
        // 各 Habit ごとに item を組み立てる
        // ----------------------------------------------------
        foreach ($habits as $h) {

            // 今日のログ（最新を使用）
            $todayLogs = $logs[$h->id] ?? collect();
            $log = $todayLogs->first();

            // status
            $status = $log?->status ?? 'none';
            if ($status === 'done') {
                $doneCount++;
            }

            // pending remind_task（pending の中で一番近い future）
            $pending = null;
            if ($log) {
                $pending = $log->remindTasks()
                    ->where('status', 'pending')
                    ->where('remind_at', '>', $now)
                    ->orderBy('remind_at', 'asc')
                    ->first();
            }

            // フロントが期待する shape:
            // {
            //   h: {...},
            //   log: {...},   ← today_log ではなく log
            //   pending_task: {...}
            // }
            $items[] = [
                'h' => [
                    'id'         => $h->id,
                    'title'      => $h->title,
                    'name'       => $h->name,
                    'time_slot'  => (int)($h->time_slot ?? 0),
                    'category'   => $h->category,
                    'color_tag'  => $h->color_tag,
                    'evaluation_type' => $h->evaluation_type,
                ],

                // 今日の HabitLog
                'today_log' => $log ? [
                    'id'         => $log->id,
                    'status'     => $log->status,
                    'rating'     => $log->rating,
                    'value'      => $log->value,
                    'time_slot'  => (int)($log->time_slot ?? $h->time_slot ?? 0),
                    'date'       => Carbon::parse($log->date)->toDateString(),
                    'checked_at' => optional($log->checked_at)?->toIso8601String(),
                    'updated_at' => optional($log->updated_at)?->toIso8601String(),
                ] : null,

                // 最も近い pending remind_task
                'pending_task' => $pending ? [
                    'id'        => $pending->id,
                    'remind_at' => optional($pending->remind_at)?->setTimezone($tz)->toIso8601String(),
                    'status'    => $pending->status,
                ] : null,
            ];
        }

        // ----------------------------------------------------
        // pending の中で最も近いものを top_pick に
        // ----------------------------------------------------
        $nearest = collect($items)
            ->filter(fn ($it) => $it['pending_task'] !== null)
            ->sortBy(fn ($it) => $it['pending_task']['remind_at'])
            ->first();

        $topPick = $nearest ? [
            'habit_id'       => $nearest['h']['id'],
            'remind_task_id' => $nearest['pending_task']['id'],
        ] : null;

        // ----------------------------------------------------
        // slot definitions（front と共有）
        // ----------------------------------------------------
        $slotDefs = [
            ['label' => 'anytime', 'code' => 0],
            ['label' => 'morning', 'code' => 1],
            ['label' => 'noon',    'code' => 2],
            ['label' => 'evening', 'code' => 3],
            ['label' => 'night',   'code' => 4],
        ];

        // ----------------------------------------------------
        // 現在 slot（あなたのロジックをそのまま採用）
        // ----------------------------------------------------
        $minutes = $now->hour * 60 + $now->minute;

        if ($minutes < 5 * 60) {
            $nowSlot = 4;               // 00:00〜04:59
        } elseif ($minutes < 11 * 60) {
            $nowSlot = 1;               // 05:00〜10:59
        } elseif ($minutes < 16 * 60) {
            $nowSlot = 2;               // 11:00〜15:59
        } elseif ($minutes < 20 * 60) {
            $nowSlot = 3;               // 16:00〜19:59
        } else {
            $nowSlot = 4;               // 20:00〜23:59
        }

        // ----------------------------------------------------
        // 最終 JSON
        // ----------------------------------------------------
        return response()->json([
            'planned'  => $items,

            'progress' => [
                'planned_count' => count($items),
                'done_count'    => $doneCount,
            ],

            'top_pick' => $topPick,

            'now'      => $now->toDateTimeString(),
            'date'     => $today->toDateString(),
            'timezone' => $tz,
            'now_slot' => $nowSlot,
            'slot_defs'=> $slotDefs,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }
}