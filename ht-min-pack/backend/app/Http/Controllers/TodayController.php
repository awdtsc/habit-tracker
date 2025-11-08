<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;

class TodayController extends Controller
{
    /**
     * GET /api/today
     * 返すもの:
     * - planned: 今日やるべき習慣（isScheduledFor($today) が true）
     *   - 各習慣について: h（基本情報）, today_log, pending_task（未来の最新1件）
     * - progress: { planned_count, done_count }
     * - top_pick: { habit_id, remind_task_id } | null
     */
    public function show(Request $request)
    {
        $user   = $request->user();
        $today  = Carbon::today();
        $now    = Carbon::now();

        // まず全習慣を eager load
        $habits = Habit::with([
            'times',
            'logs' => function ($q) use ($today) {
                $q->whereDate('date', $today->toDateString())
                  ->orderByDesc('id'); // 同日内で最新優先
            },
            'logs.remindTasks' => function ($q) use ($now) {
                // 未来のものだけ（=表示対象）
                $q->where('remind_at', '>', $now)
                  ->orderByDesc('remind_at'); // 最新(時刻が遅い順)。後で先頭だけ使う
            },
        ])
        ->where('user_id', $user->id)
        ->get();

        // 今日やるべきものだけに絞る（モデルに isScheduledFor($date) がある前提）
        $planned = $habits->filter(fn ($h) => method_exists($h, 'isScheduledFor') ? $h->isScheduledFor($today) : true)
                          ->values();

        // 整形
        $items = [];
        $doneCount = 0;

        foreach ($planned as $h) {
            // 今日のログ（あれば最新1件）
            $todayLog = $h->logs->first(); // whereDate済み + id desc
            $status   = $todayLog?->status ?? 'none';
            if ($status === 'done') $doneCount++;

            // 未来pendingの最新1件（あるなら配列先頭）
            $pending = $todayLog?->remindTasks?->first();

            $items[] = [
                'h' => [
                    'id'            => $h->id,
                    'title'         => $h->title,
                    'time_slot'     => $h->time_slot,
                    'category'      => $h->category,
                    'color_tag'     => $h->color_tag,
                    'evaluation'    => $h->evaluation_type,
                ],
                'today_log' => $todayLog ? [
                    'id'        => $todayLog->id,
                    'status'    => $todayLog->status,
                    'rating'    => $todayLog->rating,
                    'time_slot' => $todayLog->time_slot,
                ] : null,
                'pending_task' => $pending ? [
                    'id'        => $pending->id,
                    'remind_at' => $pending->remind_at?->toDateTimeString(),
                    'status'    => $pending->status,
                ] : null,
            ];
        }

        // おすすめ（top_pick）: 一番近い remind_at（未来）のもの。無ければ null
        $nearest = collect($items)
            ->filter(fn($it) => $it['pending_task'] !== null)
            ->sortBy(fn($it) => $it['pending_task']['remind_at'])
            ->first();

        $topPick = $nearest ? [
            'habit_id'       => $nearest['h']['id'],
            'remind_task_id' => $nearest['pending_task']['id'],
        ] : null;

        return response()->json([
            'planned'  => $items,
            'progress' => [
                'planned_count' => count($items),
                'done_count'    => $doneCount,
            ],
            'top_pick' => $topPick,
            'now'      => $now->toDateTimeString(),
            'date'     => $today->toDateString(),
        ]);
    }
}