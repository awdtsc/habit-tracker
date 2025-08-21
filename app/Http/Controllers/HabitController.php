<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use Illuminate\Support\Facades\Auth;
use App\Models\HabitLog;
use Carbon\Carbon;
use Illuminate\Validation\Rule;

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
     * 共通: request から保存ペイロードを作る
     * - frequency_type に quota を追加
     * - weekly_quota を target_times に保存（JSON）
     */
    private function makePayload(Request $request): array
    {
        $request->validate([
            'title'          => ['required','string','max:255'],
            'description'    => ['nullable','string'],

            // ★ quota を追加
            'frequency_type' => ['required', Rule::in(['daily','weekdays','weekends','custom','quota'])],

            // custom のときのみ曜日必須（1..7 = Mon..Sun）
            'days_of_week'   => ['array','required_if:frequency_type,custom'],
            'days_of_week.*' => ['integer','between:1,7'],

            // 週クオータ型のときのみ必須（1..7 回の範囲）
            'weekly_quota'   => ['required_if:frequency_type,quota','integer','between:1,7'],

            'start_date'     => ['required','date'],
            'end_date'       => ['nullable','date','after_or_equal:start_date'],

            // UIの「終了日なし（ずっと）」チェックボックス
            'no_end'         => ['sometimes','boolean'],

            // 任意メタ
            'time_slot'      => ['nullable', Rule::in(['anytime','morning','noon','evening','night'])],
            'category'       => ['nullable','string','max:50'],
            'color_tag'      => ['nullable','string','max:20'],
        ]);

        $type     = $request->input('frequency_type');
        $isCustom = $type === 'custom';

        // カスタム曜日（casts で JSON 化される想定）
        $days = $isCustom
            ? array_values(array_unique(array_map('intval', $request->input('days_of_week', []))))
            : null;

        // ★ 週クオータは target_times に保存（配列→castsでJSON）
        $targetTimes = ($type === 'quota')
            ? ['weekly' => (int) $request->input('weekly_quota', 1)]
            : null;

        return [
            'title'          => $request->string('title'),
            'description'    => $request->input('description'),
            'frequency_type' => $type,
            'days_of_week'   => $days,
            'target_times'   => $targetTimes,                          // ★ 追加
            'start_date'     => $request->input('start_date'),
            'end_date'       => $request->boolean('no_end') ? null : $request->input('end_date'),
            'time_slot'      => $request->input('time_slot', 'anytime'),
            'category'       => $request->input('category'),
            'color_tag'      => $request->input('color_tag'),
        ];
    }

    public function store(Request $request)
    {
        $payload = $this->makePayload($request);
        $payload['user_id'] = Auth::id();

        Habit::create($payload);

        return redirect()->route('habits.index')->with('success', '習慣を登録しました。');
    }

    public function index()
    {
        $userId = Auth::id();

        $habits = Habit::where('user_id', $userId)
            ->orderBy('id', 'desc')
            ->get();

        $today = Carbon::today()->toDateString();

        // 今日分について habit_id ごとに「その日の最新 id」を取る
        $sub = HabitLog::where('user_id', $userId)
            ->whereDate('date', $today)
            ->selectRaw('habit_id, MAX(id) AS id')
            ->groupBy('habit_id');

        // その id の status を取得（true/false を habit_id => bool の連想配列に）
        $rows = HabitLog::joinSub($sub, 't', 'habit_logs.id', '=', 't.id')
            ->get(['habit_logs.habit_id', 'habit_logs.status']);

        // 例: [ 1 => true, 2 => false, ... ]
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

    public function update(Request $request, Habit $habit)
    {
        // 必要ならポリシー: $this->authorize('update', $habit);
        $payload = $this->makePayload($request);
        $habit->update($payload);

        return redirect()->route('habits.index')->with('success', '習慣を更新しました。');
    }
}