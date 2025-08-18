<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Carbon;
use App\Models\HabitLog;

class HabitController extends Controller
{
    // フォーム画面を表示する
    public function create()
    {
        return view('habits.create'); // resources/views/habits/create.blade.php を表示
    }

    public function destroy(Habit $habit)
    {
        $habit->delete();

        return redirect()->route('habits.index')->with('success', '習慣を削除しました');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'frequency_type' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'days_of_week' => 'nullable|array', // ← 追加
            'days_of_week.*' => 'in:0,1,2,3,4,5,6', // ← 曜日制限
        ]);

        $validated['user_id'] = Auth::id();

        // カスタム頻度なら曜日配列をJSONで保存、それ以外ならnull
        if ($validated['frequency_type'] === 'custom') {
            $validated['days_of_week'] = json_encode($request->input('days_of_week', []));
        } else {
            $validated['days_of_week'] = null;
        }

        Habit::create($validated);

        return redirect()->route('habits.index')->with('success', '習慣を登録しました。');
    }

    public function index()
    {
        $user = Auth::user();
        $habits = Habit::where('user_id', $user->id)->get();

        // 今日の日付
        $today = Carbon::today()->toDateString();

        // 今日チェック済みの habit_id を配列で取得
        $checkedToday = HabitLog::where('user_id', $user->id)
            ->whereDate('date', $today)
            ->pluck('habit_id')
            ->toArray();

        return view('habits.index', compact('habits', 'checkedToday'));
    }

    public function edit(Habit $habit)
    {
        return view('habits.edit', compact('habit'));
    }

    // フォームからの更新処理
    public function update(Request $request, $id)
    {
        $habit = Habit::findOrFail($id);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'frequency_type' => 'required|in:daily,weekly,custom',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'days_of_week' => 'nullable|array', // ← 追加
            'days_of_week.*' => 'in:0,1,2,3,4,5,6', // ← 曜日制限
        ]);

        if ($validated['frequency_type'] === 'custom') {
            $validated['days_of_week'] = json_encode($request->input('days_of_week', []));
        } else {
            $validated['days_of_week'] = null;
        }

        $habit->update($validated);

        return redirect()->route('habits.index')->with('success', '習慣を更新しました。');
    }
}