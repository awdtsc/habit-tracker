<?php

namespace App\Http\Controllers;

use App\Models\Habit;
use App\Services\DailyInitService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Symfony\Component\HttpFoundation\Response;

class HabitInitController extends Controller
{
    // 単一Habit：当日ぶん（未来時刻のみ）生成
    public function initToday(Request $request, Habit $habit, DailyInitService $service)
    {
        abort_unless($habit->user_id === Auth::id(), Response::HTTP_FORBIDDEN);

        $result = $service->initHabitForDate(
            $habit,
            Carbon::today(),
            Carbon::now()
        );

        return response()->json([
            'habit_id'      => $habit->id,
            'date'          => Carbon::today()->toDateString(),
            'created_logs'  => $result['createdLogs'],
            'created_tasks' => $result['createdTasks'],
        ]);
    }

    // 自分の全Habit：当日ぶん（未来時刻のみ）一括生成
    public function initTodayForMe(Request $request, DailyInitService $service)
    {
        $user = $request->user();

        $totals = ['logs' => 0, 'tasks' => 0];
        $today  = Carbon::today();
        $now    = Carbon::now();

        $user->loadMissing('habits.times');

        foreach ($user->habits as $habit) {
            $r = $service->initHabitForDate($habit, $today, $now);
            $totals['logs']  += $r['createdLogs'];
            $totals['tasks'] += $r['createdTasks'];
        }

        return response()->json([
            'date'          => $today->toDateString(),
            'created_logs'  => $totals['logs'],
            'created_tasks' => $totals['tasks'],
        ]);
    }
}