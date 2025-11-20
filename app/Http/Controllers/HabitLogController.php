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
     * ============================================================
     *  POST /api/habit-logs/toggle
     *  フロント仕様に完全同期した toggle 処理
     * ============================================================
     */
    public function toggle(Request $request)
    {
        $userId  = Auth::id();
        $habitId = (int) $request->input('habit_id');
        $dateIso = (string) $request->input('date');
        $slot    = (int) ($request->input('time_slot') ?? 0);

        // legacy パラメータ禁止
        if ($request->has('checked')) {
            abort(422, 'parameter "checked" is deprecated. use `value` instead.');
        }

        // value(true/false/null=toggle)
        $valueParam = $request->has('value')
            ? filter_var($request->input('value'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;

        // rating(self 用)
        $ratingParam = $request->input('rating', null);
        $ratingVal   = is_numeric($ratingParam) ? (int) $ratingParam : null;

        // ---- date ----
        try {
            $date = Carbon::parse($dateIso)->startOfDay();
        } catch (\Exception $e) {
            abort(422, 'Invalid date format');
        }

        // 未来日は不可
        if ($date->gt(Carbon::today())) {
            abort(422, 'Future dates are not allowed.');
        }

        // ---- habit ----
        $habit = Habit::where('user_id', $userId)->findOrFail($habitId);
        abort_unless($habit->isScheduledFor($date, $slot), 422, 'Not scheduled on this date.');

        // ---- existing row ----
        $row = HabitLog::where('user_id', $userId)
            ->where('habit_id', $habitId)
            ->where('date', $date->toDateString())
            ->where('time_slot', $slot)
            ->first();

        $currentStatus = $row?->status ?? 'none';

        // ============================================================
        //  フロント仕様：desired（最終的に done/none にしたいか）
        // ============================================================
        $desired = is_null($valueParam)
            ? ($currentStatus !== 'done') // toggle
            : (bool) $valueParam;

        $finalRating = $row?->rating ?? 0;
        $finalStatus = 'none';

        if ($habit->evaluation_type === 'simple') {
            // simple → done/none のみ
            $finalStatus = $desired ? 'done' : 'none';
            $finalRating = 0;

        } elseif ($habit->evaluation_type === 'self') {
            // self → rating >= 4 = done
            if ($ratingVal !== null) {
                $finalRating = max(0, min(4, $ratingVal));
            }
            $finalStatus = ($finalRating >= 4) ? 'done' : 'none';

        } else {
            abort(422, 'Unknown evaluation_type: ' . $habit->evaluation_type);
        }

        // ============================================================
        //  Upsert
        // ============================================================
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
                'checked_at' => now(),
            ]
        );

        $log->refresh();

        return response()->json([
            'ok'         => true,
            'habit_id'   => $habitId,
            'date'       => $date->toDateString(),
            'time_slot'  => $slot,
            'status'     => $log->status,
            'value'      => $log->status === 'done',
            'rating'     => $log->rating,
            'updated_at' => optional($log->checked_at)->toDateTimeString(),
        ]);
    }



    /**
     * ============================================================
     *  GET /api/habit-logs?start=YYYY-MM-DD&end=YYYY-MM-DD
     *  WeeklyBoard / Today の共通ログロード
     * ============================================================
     */
    public function index(Request $request)
    {
        $userId = Auth::id();
        $start  = $request->query('start');
        $end    = $request->query('end');

        if (!$start || !$end) {
            return response()->json([
                'error' => 'start and end are required',
            ], 422);
        }

        try {
            $s = Carbon::parse($start)->startOfDay();
            $e = Carbon::parse($end)->endOfDay();
        } catch (\Exception $e) {
            abort(422, 'Invalid start or end date.');
        }

        $rows = HabitLog::where('user_id', $userId)
            ->whereBetween('date', [$s->toDateString(), $e->toDateString()])
            ->orderBy('date')
            ->orderBy('time_slot')
            ->get();

        $logs = $rows->map(function (HabitLog $l) {
            return [
                'habit_id'   => (int) $l->habit_id,
                'date'       => Carbon::parse($l->date)->toDateString(),
                'time_slot'  => (int) $l->time_slot,
                'status'     => $l->status,
                'rating'     => (int) $l->rating,
                'checked_at' => optional($l->checked_at)->toDateTimeString(),
            ];
        })->values();

        return response()->json([
            'logs'  => $logs,
            'start' => $s->toDateString(),
            'end'   => $e->toDateString(),
        ]);
    }
}