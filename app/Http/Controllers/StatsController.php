<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Models\Habit;
use Carbon\Carbon;

class StatsController extends Controller
{
    /** ?start=YYYY-MM-DD を月曜起点に正規化して [start,end] を返す */
    private function weekRange(Request $req): array
    {
        $start = $req->query('start')
            ? Carbon::parse($req->query('start'))->startOfDay()
            : Carbon::now()->startOfDay();
        $w = $start->isoWeekday();
        if ($w !== 1) $start->subDays($w - 1); // 月曜
        $end = $start->copy()->addDays(6);
        return [$start, $end];
    }

    /** 週の日別達成率（0-100 の整数%） */
    public function weeklyByDay(Request $req)
    {
        $userId = Auth::id();
        [$start,$end] = $this->weekRange($req);

        $dates = collect(range(0,6))->map(fn($i) => $start->copy()->addDays($i)->toDateString());

        $habits = Habit::where('user_id',$userId)->get([
            'id','title','start_date','end_date','frequency_type','days_of_week'
        ]);

        // (habit_id,date) の最新行だけ拾う
        $sub = DB::table('habit_logs')
            ->selectRaw('MAX(id) AS id')
            ->where('user_id',$userId)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('habit_id','date');

        $rows = DB::table('habit_logs')
            ->whereIn('id', $sub)
            ->select('habit_id','date','status')
            ->get();

        $latest = [];
        foreach ($rows as $r) {
            $latest[$r->habit_id.'|'.Carbon::parse($r->date)->toDateString()] = (bool)$r->status;
        }

        $list = [];
        $rates = [];
        foreach ($dates as $d) {
            $dateObj = Carbon::parse($d);
            $plannedIds = $habits->filter(fn($h) => $h->isScheduledFor($dateObj))->pluck('id')->all();
            $den = count($plannedIds);
            if ($den === 0) { $list[]=['date'=>$d,'rate'=>0]; $rates[] = 0; continue; }
            $num = 0;
            foreach ($plannedIds as $hid) {
                if (!empty($latest[$hid.'|'.$d])) $num++;
            }
            $rate = (int) round(($num * 100) / $den);
            $list[] = ['date'=>$d, 'rate'=>$rate];
            $rates[] = $rate;
        }

        return response()->json(['list'=>$list, 'rates'=>$rates]);
    }

    /** weekly board: habits / checks / rates 一括 */
    public function weeklyBoard(Request $req)
    {
        $userId = Auth::id();
        [$start,$end] = $this->weekRange($req);

        // ここを拡張：一覧で必要なフィールドもまとめて返す
        $habits = Habit::where('user_id',$userId)
            ->get([
                'id','title','description',
                'frequency_type','days_of_week',
                'start_date','end_date',
                'time_slot','category','color_tag',
            ])
            ->map(function($h){
                return [
                    'id'            => (int)$h->id,
                    'title'         => $h->title,
                    'description'   => $h->description,
                    'frequency_type'=> $h->frequency_type,
                    'days_of_week'  => is_array($h->days_of_week) ? $h->days_of_week : (array)$h->days_of_week,
                    'start_date'    => optional($h->start_date)->toDateString(),
                    'end_date'      => optional($h->end_date)->toDateString(),
                    'time_slot'     => $h->time_slot,
                    'category'      => $h->category,
                    'color_tag'     => $h->color_tag,
                ];
            })->values();

        // 今週のチェック最新のみ（既存）
        $sub = DB::table('habit_logs')
            ->selectRaw('MAX(id) AS id')
            ->where('user_id',$userId)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->groupBy('habit_id','date');

        $logs = DB::table('habit_logs')
            ->whereIn('id', $sub)
            ->select('habit_id','date','status')
            ->orderBy('date')->orderBy('habit_id')
            ->get();

        $checks = $logs->map(fn($l) => [
            'habit_id' => (int)$l->habit_id,
            'date'     => \Carbon\Carbon::parse($l->date)->toDateString(),
            'value'    => (bool)$l->status,
        ])->values();

        $rates = $this->weeklyByDay($req)->getData(true)['rates'];

        return response()->json([
            'habits' => $habits,
            'checks' => $checks,
            'rates'  => $rates,
        ]);
    }
}