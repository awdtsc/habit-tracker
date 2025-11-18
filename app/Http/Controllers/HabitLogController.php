<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\Models\Habit;
use App\Models\HabitLog;

class HabitLogController extends Controller
{
    /**
     * POST /api/habit-logs/toggle
     *
     * フロント仕様に完全同期した toggle 処理。
     * - simple/self どちらも返す status は 'done' or 'none' の二値のみ
     * - self は rating>=4 を done として扱う
     */
    public function toggle(Request $request)
    {
        $userId  = Auth::id();
        $habitId = (int)$request->input('habit_id');
        $dateIso = (string)$request->input('date');
        $slot    = (int)($request->input('time_slot') ?? 0);

        if ($request->has('checked')) {
            abort(422, 'parameter "checked" is deprecated. use value instead.');
        }

        // value → true/false/null（null = front toggle）
        $valueParam = $request->has('value')
            ? filter_var($request->input('value'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;

        // rating（self のときのみ使用, 0〜4）
        $ratingParam = $request->input('rating', null);
        $ratingVal   = is_numeric($ratingParam) ? (int)$ratingParam : null;

        // ---- date ----
        $date = Carbon::parse($dateIso)->startOfDay();
        abort_if($date->gt(Carbon::today()), 422, 'Future dates are not allowed.');

        // ---- habit ----
        $habit = Habit::where('user_id', $userId)->findOrFail($habitId);
        abort_unless($habit->isScheduledFor($date, $slot), 422, 'Not scheduled on this date.');

        // ---- existing row ----
        $row = HabitLog::where('user_id', $userId)
            ->where('habit_id', $habitId)
            ->whereDate('date', $date->toDateString())
            ->where('time_slot', $slot)
            ->first();

        $currentStatus = $row?->status ?? 'none';

        // === front の「action」に同期 ===
        // front では:
        // - simple: toggle or forced rating>=4?
        // - self: rating>=4 → done、rating=0 → none
        // desired を front とロジック合わせる
        $desired = is_null($valueParam)
            ? ($currentStatus !== 'done')
            : (bool)$valueParam;

        $finalRating = $row?->rating ?? 0;
        $finalStatus = 'none';
        $checkedAt   = now();

        if ($habit->evaluation_type === 'simple') {
            // simple → done/none のみ
            $finalStatus = $desired ? 'done' : 'none';
            $finalRating = 0;

        } elseif ($habit->evaluation_type === 'self') {
            // self → rating あれば優先
            if ($ratingVal !== null) {
                $finalRating = max(0, min(4, $ratingVal));
            }

            // done/none 二値に統一（front の normalizeDone と合わせる）
            $finalStatus = ($finalRating >= 4) ? 'done' : 'none';

        } else {
            abort(422, 'Unknown evaluation_type: ' . $habit->evaluation_type);
        }

        // --- upsert ---
        $log = HabitLog::updateOrCreate(
            [
                'user_id'   => $userId,
                'habit_id'  => $habitId,
                'date'      => $date->toDateString(),
                'time_slot' => $slot,
            ],
            [
                'status'     => $finalStatus,
                'rating'     => $finalRating,
                'checked_at' => $checkedAt,
            ]
        );

        $log->refresh();

        return response()->json([
            'ok'         => true,
            'status'     => $log->status,             // "done" / "none"
            'value'      => $log->status === 'done',  // true/false
            'rating'     => $log->rating,
            'checked_at' => optional($log->checked_at)->toDateTimeString(),
            'date'       => $date->toDateString(),
            'habit_id'   => $habitId,
            'time_slot'  => $slot,
        ]);
    }


    /**
     * GET /api/habit-logs?start=YYYY-MM-DD&end=YYYY-MM-DD
     *
     * WeekTab の loadLogs() のための区間ログ一覧。
     * StatsController::logs() と返却形式を完全統一。
     */
    public function index(Request $request)
    {
        $userId = Auth::id();
        $start = $request->query('start');
        $end   = $request->query('end');

        $logs = HabitLog::where('user_id', $userId)
            ->whereBetween('date', [$start, $end])
            ->get([
                'habit_id',
                'date',
                'time_slot',
                'status',
                'rating',
                'checked_at',
            ])
            ->map(function (HabitLog $l) {
                return [
                    'habit_id'   => (int) $l->habit_id,
                    'date'       => Carbon::parse($l->date)->toDateString(),
                    'time_slot'  => (int) $l->time_slot,
                    'status'     => $l->status,
                    'rating'     => $l->rating,
                    'checked_at' => optional($l->checked_at)->toDateTimeString(),
                ];
            })
            ->values();

        return response()->json([
            'logs' => $logs,
            'start' => $start,
            'end'   => $end,
        ]);
    }
}