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

        // タイムゾーン
        $tz    = $user->timezone ?? config('app.timezone', 'Asia/Tokyo');
        $today = Carbon::now($tz)->startOfDay();
        $now   = Carbon::now($tz);

        // 今日のログ & pending
        $habits = Habit::with([
            'logs' => function ($q) use ($today) {
                $q->whereDate('date', $today->toDateString())
                  ->orderByDesc('id');
            },
            'logs.remindTasks' => function ($q) use ($now) {
                $q->where('status', 'pending')
                  ->where('remind_at', '>', $now)
                  ->orderBy('remind_at', 'asc');
            },
            'times',
        ])
        ->where('user_id', $user->id)
        ->orderBy('id')
        ->get();

        $items = [];
        $doneCount = 0;

        foreach ($habits as $h) {

            $todayLog = $h->logs->first();
            $status   = $todayLog?->status ?? 'none';

            if ($status === 'done') {
                $doneCount++;
            }

            $pending = $todayLog?->remindTasks?->first();

            $items[] = [
                'h' => [
                    'id'         => $h->id,
                    'title'      => $h->title,
                    'name'       => $h->name,
                    'time_slot'  => (int)($h->time_slot ?? 0),
                    'category'   => $h->category,
                    'color_tag'  => $h->color_tag,
                    'evaluation' => $h->evaluation_type,
                ],
                'today_log' => $todayLog ? [
                    'id'         => $todayLog->id,
                    'status'     => $todayLog->status,
                    'rating'     => $todayLog->rating,
                    'time_slot'  => (int)($todayLog->time_slot ?? 0),
                    'date'       => optional($todayLog->date)?->toDateString(),
                    'updated_at' => optional($todayLog->updated_at)?->toIso8601String(),
                ] : null,
                'pending_task' => $pending ? [
                    'id'        => $pending->id,
                    'remind_at' => optional($pending->remind_at)?->setTimezone($tz)->toIso8601String(),
                    'status'    => $pending->status,
                ] : null,
            ];
        }

        // pending の中で一番近いもの
        $nearest = collect($items)
            ->filter(fn ($it) => $it['pending_task'] !== null)
            ->sortBy(fn ($it) => $it['pending_task']['remind_at'])
            ->first();

        $topPick = $nearest ? [
            'habit_id'       => $nearest['h']['id'],
            'remind_task_id' => $nearest['pending_task']['id'],
        ] : null;

        // slot 定義（front と共通）
        $slotDefs = [
            ['label' => 'anytime', 'code' => 0],
            ['label' => 'morning', 'code' => 1],
            ['label' => 'noon',    'code' => 2],
            ['label' => 'evening', 'code' => 3],
            ['label' => 'night',   'code' => 4],
        ];

        /**
         * === 新しい now_slot 判定 ===
         *
         * 00:00–04:59  → night (4)
         * 05:00–10:59  → morning (1)
         * 11:00–15:59  → noon (2)
         * 16:00–19:59  → evening (3)
         * 20:00–23:59  → night (4)
         */
        $minutes = ((int)$now->format('H')) * 60 + (int)$now->format('i');

        if ($minutes < 5 * 60) {
            $nowSlot = 4;
        } elseif ($minutes < 11 * 60) {
            $nowSlot = 1;
        } elseif ($minutes < 16 * 60) {
            $nowSlot = 2;
        } elseif ($minutes < 20 * 60) {
            $nowSlot = 3;
        } else {
            $nowSlot = 4;
        }

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