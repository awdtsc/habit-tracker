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
     *
     * 返すもの:
     * - planned: 今日やるべき習慣
     *   - 各要素: h（習慣の基本情報）, today_log（今日のログ or null）, pending_task（未来の最新1件 or null）
     * - progress: { planned_count, done_count }
     * - top_pick: { habit_id, remind_task_id } | null（最も近い remind_at を持つ pending）
     * - now / date / timezone / now_slot / slot_defs
     */
    public function show(Request $request)
    {
        $user = $request->user();

        // タイムゾーン（ユーザー個別があれば優先）
        $tz     = $user->timezone ?? config('app.timezone', 'Asia/Tokyo');
        $today  = Carbon::now($tz)->startOfDay();
        $now    = Carbon::now($tz);

        // 習慣を一括取得（今日のログと、そのログに紐づく未来pendingリマインドを同時ロード）
        $habits = Habit::with([
            // 今日のログのみ（新しい順で先頭を todayLog として使う）
            'logs' => function ($q) use ($today) {
                $q->whereDate('date', $today->toDateString())
                  ->orderByDesc('id');
            },
            // 未来の pending リマインド（近い順）
            'logs.remindTasks' => function ($q) use ($now) {
                $q->where('status', 'pending')
                  ->where('remind_at', '>', $now)
                  ->orderBy('remind_at', 'asc');
            },
            // 時間帯や頻度定義がある場合
            'times',
        ])
        ->where('user_id', $user->id)
        ->orderBy('id')
        ->get();

        // 「今日やるべき」だけに絞る（isScheduledFor があればそれに従う。無ければ全件採用）
        $planned = $habits->filter(function ($h) use ($today) {
            return method_exists($h, 'isScheduledFor') ? (bool)$h->isScheduledFor($today) : true;
        })->values();

        $items = [];
        $doneCount = 0;

        foreach ($planned as $h) {
            /** @var HabitLog|null $todayLog */
            $todayLog = $h->logs->first();

            $status = $todayLog?->status ?? 'none';
            if ($status === 'done') {
                $doneCount++;
            }

            // 未来 pending の最新1件（昇順でロードしているので first() が最も近い）
            $pending = $todayLog?->remindTasks?->first();

            $items[] = [
                'h' => [
                    'id'               => $h->id,
                    // DBカラムの差異を吸収（name/title どちらでも可）
                    'title'            => $h->getAttribute('title') ?? $h->getAttribute('name'),
                    'name'             => $h->getAttribute('name'),
                    'time_slot'        => (int)($h->time_slot ?? 0),
                    'category'         => $h->getAttribute('category'),
                    'color_tag'        => $h->getAttribute('color_tag'),
                    'evaluation'       => $h->getAttribute('evaluation_type'),
                ],
                'today_log' => $todayLog ? [
                    'id'        => $todayLog->id,
                    'status'    => $todayLog->status,
                    'rating'    => $todayLog->rating,
                    'time_slot' => (int)($todayLog->time_slot ?? 0),
                    'date'      => optional($todayLog->date)?->toDateString(),
                    'updated_at'=> optional($todayLog->updated_at)?->toIso8601String(),
                ] : null,
                'pending_task' => $pending ? [
                    'id'        => $pending->id,
                    'remind_at' => optional($pending->remind_at)?->setTimezone($tz)->toIso8601String(),
                    'status'    => $pending->status,
                ] : null,
            ];
        }

        // 最も近い pending を top_pick として返す
        $nearest = collect($items)
            ->filter(fn ($it) => $it['pending_task'] !== null)
            ->sortBy(fn ($it) => $it['pending_task']['remind_at'])
            ->first();

        $topPick = $nearest ? [
            'habit_id'       => $nearest['h']['id'],
            'remind_task_id' => $nearest['pending_task']['id'],
        ] : null;

        // === useSlot.js に合わせた時間帯スロット定義（SSOT: フロントのロジックと一致） ===
        // 0=anytime（終日）, 1=morning, 2=noon, 3=evening, 4=night（0:00–4:59 と 21:00–23:59）
        $slotDefs = [
            ['label' => 'anytime', 'code' => 0],
            ['label' => 'morning', 'code' => 1],
            ['label' => 'noon',    'code' => 2],
            ['label' => 'evening', 'code' => 3],
            ['label' => 'night',   'code' => 4],
        ];

        // 現在時刻から now_slot を決定（useSlot.js と同一ロジック）
        $h = (int)$now->format('H');
        if ($h <= 4) {
            $nowSlot = 4;         // night
        } elseif ($h <= 10) {
            $nowSlot = 1;         // morning
        } elseif ($h <= 16) {
            $nowSlot = 2;         // noon
        } elseif ($h <= 20) {
            $nowSlot = 3;         // evening
        } else {
            $nowSlot = 4;         // night
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