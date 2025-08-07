<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\Models\HabitLog;


class DashboardController extends Controller
{
    public function index()
    {
        $userId = Auth::id(); 

        // 今週（日曜〜土曜）
        $startOfWeek = Carbon::now()->startOfWeek(Carbon::SUNDAY);
        $dates = collect();
        for ($i = 0; $i < 7; $i++) {
            $dates->push($startOfWeek->copy()->addDays($i));
        }

        // 習慣を取得（ユーザーごと）
        $habits = Habit::where('user_id', $userId)->get();

        // 今週のログをまとめて取得
        $logs = HabitLog::where('user_id', $userId)
            ->whereBetween('date', [$dates->first()->toDateString(), $dates->last()->toDateString()])
            ->get()
            ->groupBy(fn($log) => $log->habit_id . '_' . $log->date);
        return view('dashboard', compact('dates', 'habits', 'logs'));
    }
}
