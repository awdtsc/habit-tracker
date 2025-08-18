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
     * チェック/解除（当日1行運用）
     * 入力: habit_id, date(YYYY-MM-DD), value(bool)  ※value 省略時はトグル
     */
    public function toggle(Request $request)
    {
        $userId  = Auth::id();
        $habitId = (int)$request->input('habit_id');
        $dateIso = (string)$request->input('date');

        // “checked” 等の別名は不許可にして仕様一本化
        if ($request->has('checked')) abort(422, 'パラメータ checked は廃止しました。value を使用してください。');

        $valueParam = $request->has('value')
            ? filter_var($request->input('value'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
            : null;

        $date = Carbon::parse($dateIso)->startOfDay();
        abort_if($date->gt(Carbon::today()), 422, '未来日は記録できません。');

        $habit = Habit::where('user_id', $userId)->findOrFail($habitId);
        abort_unless($habit->isScheduledFor($date), 422, '予定日ではありません。');

        $row = HabitLog::where('user_id',$userId)
            ->where('habit_id',$habitId)
            ->whereDate('date',$date->toDateString())
            ->first();

        $current = (bool)($row->status ?? false);
        $desired = is_null($valueParam) ? !$current : (bool)$valueParam;

        HabitLog::updateOrCreate(
            ['user_id'=>$userId,'habit_id'=>$habitId,'date'=>$date->toDateString()],
            ['status'=>$desired, 'checked_at'=>$desired ? now() : ($row?->checked_at)]
        );

        return response()->json([
            'ok'    => true,
            'value' => $desired,
            'date'  => $date->toDateString(),
            'id'    => $habitId,
        ]);
    }
}