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
     * チェック/解除・自己評価（当日1行運用）
     * 入力: habit_id, date(YYYY-MM-DD), value(bool), rating(int)
     * value 省略時はトグル、rating は自己評価型のときのみ使用
     */
    public function toggle(Request $request)
    {
        $userId  = Auth::id();
        $habitId = (int)$request->input('habit_id');
        $dateIso = (string)$request->input('date');
        $slot    = (int)($request->input('time_slot') ?? 0); // 0=終日

        // “checked” 等の別名は不許可
        if ($request->has('checked')) {
            abort(422, 'パラメータ checked は廃止しました。value を使用してください。');
        }

        // value は true/false/null（null=トグル）
        $valueParam = $request->has('value')
            ? filter_var($request->input('value'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;

        // rating（自己評価型用: 0〜4）
        $ratingParam = $request->input('rating', null);
        $ratingVal   = is_numeric($ratingParam) ? (int)$ratingParam : null;

        // 日付バリデーション
        $date = Carbon::parse($dateIso)->startOfDay();
        abort_if($date->gt(Carbon::today()), 422, '未来日は記録できません。');

        // 習慣取得＋予定判定
        $habit = Habit::where('user_id', $userId)->findOrFail($habitId);
        abort_unless($habit->isScheduledFor($date, $slot), 422, '予定日ではありません。');

        // 既存行の取得
        $row = HabitLog::where('user_id', $userId)
            ->where('habit_id', $habitId)
            ->whereDate('date', $date->toDateString())
            ->where('time_slot', $slot)
            ->first();

        // 現在の状態
        $current = $row?->status ?? 'none';
        $desired = is_null($valueParam) ? ($current !== 'done') : (bool)$valueParam;

        // === 判定ロジック ===
        $statusStr   = 'none';
        $finalRating = $ratingVal ?? $row?->rating ?? 0;
        $checkedAt   = null;

        if ($habit->evaluation_type === 'simple') {
            // 単純評価型
            $statusStr   = $desired ? 'done' : 'none';
            $finalRating = 0;
            $checkedAt   = now();

        } elseif ($habit->evaluation_type === 'self') {
            // 自己評価型
            if ($ratingVal !== null) {
                // rating が送られてきた場合
                $finalRating = $ratingVal;
                $checkedAt   = now();

                if ($ratingVal >= 4) {
                    $statusStr = 'done';
                } elseif ($ratingVal >= 1) {
                    $statusStr = 'inprogress';
                } else {
                    $statusStr = 'none';
                }

            } else {
                // rating が送られてこなかった場合 → 直前の rating を維持して status 再判定
                $finalRating = $row?->rating ?? 0;

                if ($finalRating >= 4) {
                    $statusStr = 'done';
                } elseif ($finalRating >= 1) {
                    $statusStr = 'inprogress';
                } else {
                    $statusStr = 'none';
                }

                $checkedAt = now();
            }

        } else {
            abort(422, '不明な評価タイプ: '.$habit->evaluation_type);
        }

        // === upsert ===
        $log = HabitLog::updateOrCreate(
            [
                'user_id'   => $userId,
                'habit_id'  => $habitId,
                'date'      => $date->toDateString(),
                'time_slot' => $slot,
            ],
            [
                'status'     => $statusStr,
                'rating'     => $finalRating,
                'checked_at' => $checkedAt,
            ]
        );

        $log->refresh();

        return response()->json([
            'ok'         => true,
            'status'     => $log->status,             // "done" / "none"
            'value'      => $log->status === 'done',  // true / false
            'rating'     => $log->rating,
            'checked_at' => optional($log->checked_at)->toDateTimeString(),
            'date'       => $date->toDateString(),
            'id'         => $habitId,
            'time_slot'  => $slot,
        ]);
    }

    public function index(Request $request)
    {
        $start = $request->query('start');
        $end   = $request->query('end');

        $logs = HabitLog::where('user_id', auth::id())
            ->whereBetween('date', [$start, $end])
            ->get();

        return response()->json([
            'logs' => $logs,
        ]);
    }

}
