<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Habit;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use App\Models\HabitLog;


class DashboardController extends Controller
{
    public function index(Request $req)
    {
        $userId = Auth::id();
        $start  = $req->filled('start')
            ? Carbon::parse($req->query('start'))->startOfWeek(Carbon::MONDAY)
            : Carbon::now()->startOfWeek(Carbon::MONDAY);
        $end    = $start->copy()->addDays(6);

        // 表示する7日
        $days = collect(range(0,6))->map(fn($i) => $start->copy()->addDays($i));

        $habits = Habit::where('user_id', $userId)
            ->orderBy('id')->get(['id','title','days_of_week','start_date','end_date']);

        // 当週ログ → 最新状態を map に
        $logs = HabitLog::where('user_id',$userId)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('id','desc')->get()
            ->groupBy(fn($r)=>$r->date.'#'.$r->habit_id);

        $checkedMap = [];
        foreach ($days as $d) {
            foreach ($habits as $h) {
                $key = $d->toDateString().'#'.$h->id;
                $checkedMap[$key] = ($logs->get($key)?->first()?->status) === 'checked';
            }
        }

        return view('dashboard', [
            'week' => [
                'start' => $start, 'end' => $end,
                'prev' => $start->copy()->subWeek()->toDateString(),
                'next' => $start->copy()->addWeek()->toDateString(),
            ],
            'days' => $days,
            'habits' => $habits,
            'checkedMap' => $checkedMap,
        ]);
    }

    public function today(Request $req)
    {
        $userId = Auth::id();
        $today  = Carbon::today();

        // 今日の習慣を全部取る（まずはシンプルに全件）
        $habits = Habit::where('user_id', $userId)
            ->orderBy('id')
            ->get(['id','title','days_of_week','start_date','end_date','time_slot']);

        // 今日のログ
        $logs = HabitLog::where('user_id', $userId)
            ->whereDate('date', $today->toDateString())
            ->orderBy('id','desc')
            ->get()
            ->groupBy('habit_id');

        $checkedMap = [];
        foreach ($habits as $h) {
            $checkedMap[$h->id] = ($logs->get($h->id)?->first()?->status) === 'checked';
        }

        return view('dashboard.today', [
            'date'        => $today,
            'habits'      => $habits,
            'checkedMap'  => $checkedMap,
        ]);
    }

    private function getWeekDates(int $weekOffset): array
    {
        $startOfWeek = Carbon::now()->startOfWeek()->addWeeks($weekOffset);
        $dates = [];

        for ($i = 0; $i < 7; $i++) {
            $dates[] = $startOfWeek->copy()->addDays($i);
        }

        return $dates;
    }
}
