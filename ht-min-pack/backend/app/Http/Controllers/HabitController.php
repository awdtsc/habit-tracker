<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use App\Models\HabitTime;
use Illuminate\Support\Facades\Auth;
use App\Models\HabitLog;
use Carbon\Carbon;
use Illuminate\Validation\Rule;
use App\Services\DailyInitService;

class HabitController extends Controller
{
    // 作成フォーム
    public function create()
    {
        return view('habits.create');
    }

    public function destroy(Habit $habit)
    {
        $habit->delete();
        return redirect()->route('habits.index')->with('success', '習慣を削除しました');
    }

    /**
     * 共通: request から Habit 用のペイロードを作る
     */
    private function makePayload(Request $request): array
    {
        $request->validate([
            'title'           => ['required','string','max:255'],
            'description'     => ['nullable','string'],

            'frequency_type'  => ['required', Rule::in(['daily','weekdays','weekends','custom','quota'])],
            'days_of_week'    => ['array','required_if:frequency_type,custom'],
            'days_of_week.*'  => ['integer','between:1,7'],
            'weekly_quota'    => ['required_if:frequency_type,quota','integer','between:1,7'],

            'evaluation_type' => ['required', Rule::in(['simple','self'])],

            'start_date'      => ['required','date'],
            'end_date'        => ['nullable','date','after_or_equal:start_date'],
            'no_end'          => ['sometimes','boolean'],

            'time_slot'       => ['nullable', Rule::in(['anytime','morning','noon','evening','night'])],
            'category'        => ['nullable','string','max:50'],
            'color_tag'       => ['nullable','string','max:20'],

            // 通知時刻は habit_times に保存するのでここでは validate のみ
            'notify_time'     => ['nullable','date_format:H:i'],
        ]);

        $freqType = $request->input('frequency_type');
        $isCustom = $freqType === 'custom';

        $days = $isCustom
            ? array_values(array_unique(array_map('intval', $request->input('days_of_week', []))))
            : null;

        $targetTimes = ($freqType === 'quota')
            ? ['weekly' => (int) $request->input('weekly_quota', 1)]
            : null;

        // time_slot: 文字列 → 数値変換
        $slotMap = [
            'anytime' => 0,
            'morning' => 1,
            'noon'    => 2,
            'evening' => 3,
            'night'   => 4,
        ];
        $slotStr = $request->input('time_slot', 'anytime');
        $slotNum = $slotMap[$slotStr] ?? 0;

        return [
            'title'           => $request->string('title'),
            'description'     => $request->input('description'),
            'frequency_type'  => $freqType,
            'days_of_week'    => $days,
            'target_times'    => $targetTimes,
            'start_date'      => $request->input('start_date'),
            'end_date'        => $request->boolean('no_end') ? null : $request->input('end_date'),
            'time_slot'       => $slotNum,
            'category'        => $request->input('category'),
            'color_tag'       => $request->input('color_tag'),
            'evaluation_type' => $request->input('evaluation_type','simple'),
        ];
    }

    public function store(Request $request, DailyInitService $initService)
    {
        $payload = $this->makePayload($request);
        $payload['user_id'] = Auth::id();

        $habit = Habit::create($payload);

        // ★ habit_times を保存（time_slot も入れる／単一時刻対応）
        if ($request->filled('notify_time')) {
            $habit->times()->create([
                'time_slot'     => $payload['time_slot'],
                'notify_time'   => $request->input('notify_time'),
                'remind_offset' => 0,
            ]);
        }

        // ★ 当日分の HabitLog / RemindTask をサービスで生成（過去は作らない）
        $initService->initHabitForDate($habit, Carbon::today(), Carbon::now());

        return redirect()->route('dashboard')->with('success','習慣を登録しました');
    }

    public function index()
    {
        $userId = Auth::id();

        $habits = Habit::where('user_id', $userId)
            ->orderBy('id', 'desc')
            ->get();

        $today = Carbon::today()->toDateString();

        $sub = HabitLog::where('user_id', $userId)
            ->whereDate('date', $today)
            ->selectRaw('habit_id, MAX(id) AS id')
            ->groupBy('habit_id');

        $rows = HabitLog::joinSub($sub, 't', 'habit_logs.id', '=', 't.id')
            ->get(['habit_logs.habit_id', 'habit_logs.status']);

        $todayStatusByHabit = $rows->mapWithKeys(function ($r) {
            return [(int)$r->habit_id => (bool)$r->status];
        })->all();

        return view('habits.index', [
            'habits'             => $habits,
            'todayStatusByHabit' => $todayStatusByHabit,
        ]);
    }

    public function edit(Habit $habit)
    {
        return view('habits.edit', compact('habit'));
    }

    public function update(Request $request, Habit $habit, DailyInitService $initService)
    {
        $payload = $this->makePayload($request);
        $habit->update($payload);

        // ★ habit_times をリセットして再保存（単一時刻のみ対応）
        $habit->times()->delete();
        if ($request->filled('notify_time')) {
            $habit->times()->create([
                'time_slot'     => $payload['time_slot'],
                'notify_time'   => $request->input('notify_time'),
                'remind_offset' => 0,
            ]);
        }

        // ★ 当日分の生成（過去はスキップ固定）
        $initService->initHabitForDate($habit, Carbon::today(), Carbon::now());

        return redirect()->route('habits.index')->with('success', '習慣を更新しました。');
    }
}