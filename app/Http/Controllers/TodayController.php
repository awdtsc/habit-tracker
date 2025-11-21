<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;

class TodayController extends Controller
{
    /**
     * GET /api/today
     */
    public function show(Request $request)
    {
        $user = $request->user();

        // タイムゾーン
        $tz    = $user->timezone ?? config('app.timezone', 'Asia/Tokyo');
        $today = Carbon::now($tz)->startOfDay();
        $now   = Carbon::now($tz);

        // 今日のログ & 未来の pending リマインドをロード
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

        // ★ フィルタしない（習慣は全部返す）
        $planned = $habits;

        $items = [];
        $doneCount = 0;

        foreach ($planned as $h) {

            /** @var HabitLog|null */
            $todayLog = $h->logs->first();
            $status = $todayLog?->status ?? 'none';

            if ($status === 'done') {
                $doneCount++;
            }

            // 最も近い future pending
            $pending = $todayLog?->remindTasks?->first();

            $items[] = [
                'h' => [
                    'id'         => $h->id,
                    'title'      => $h->getAttribute('title') ?? $h->getAttribute('name'),
                    'name'       => $h->getAttribute('name'),
                    'time_slot'  => (int)($h->time_slot ?? 0),
                    'category'   => $h->getAttribute('category'),
                    'color_tag'  => $h->getAttribute('color_tag'),
                    'evaluation' => $h->getAttribute('evaluation_type'),
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

        // 未来 pending の中から top_pick を決定
        $nearest = collect($items)
            ->filter(fn ($it) => $it['pending_task'] !== null)
            ->sortBy(fn ($it) => $it['pending_task']['remind_at'])
            ->first();

        $topPick = $nearest ? [
            'habit_id'       => $nearest['h']['id'],
            'remind_task_id' => $nearest['pending_task']['id'],
        ] : null;

        // 時間帯スロット定義（フロントと一致）
        $slotDefs = [
            ['label' => 'anytime', 'code' => 0],
            ['label' => 'morning', 'code' => 1],
            ['label' => 'noon',    'code' => 2],
            ['label' => 'evening', 'code' => 3],
            ['label' => 'night',   'code' => 4],
        ];

        // フロントと同じ now_slot 判定
        $hour = (int)$now->format('H');

        if ($hour >= 5 && $hour <= 10) {
            $nowSlot = 1;  // 朝
        } elseif ($hour >= 11 && $hour <= 15) {
            $nowSlot = 2;  // 昼
        } elseif ($hour >= 16 && $hour <= 19) {
            $nowSlot = 3;  // 夕
        } else {
            $nowSlot = 4;  // 夜
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