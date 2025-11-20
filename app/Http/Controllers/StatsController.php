<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

use App\Models\Habit;
use App\Models\HabitLog;

class StatsController extends Controller
{
    /* ============================================================
     * 週開始日（start=YYYY-MM-DD）を「月曜起点」に正規化
     * ============================================================*/
    private function weekRange(Request $req): array
    {
        $start = $req->query('start')
            ? Carbon::parse($req->query('start'))->startOfDay()
            : Carbon::now()->startOfDay();

        $w = $start->isoWeekday();
        if ($w !== 1) {
            $start->subDays($w - 1);
        }

        $end = $start->copy()->addDays(6);
        return [$start, $end];
    }

    /* ============================================================
     * GET /api/logs?start=..&end=..
     * Weekタブ：区間ログ
     * ============================================================*/
    public function logs(Request $req): JsonResponse
    {
        $userId = Auth::id();

        $start = $req->query('start')
            ? Carbon::parse($req->query('start'))->toDateString()
            : Carbon::now()->startOfWeek()->toDateString();

        $end = $req->query('end')
            ? Carbon::parse($req->query('end'))->toDateString()
            : Carbon::now()->endOfWeek()->toDateString();

        $logs = HabitLog::where('user_id', $userId)
            ->whereBetween('date', [$start, $end])
            ->get([
                'habit_id',
                'date',
                'time_slot',
                'status',
                'rating',
                'checked_at',
            ])
            ->map(function (HabitLog $l) {
                return [
                    'habit_id'   => (int) $l->habit_id,
                    'date'       => Carbon::parse($l->date)->toDateString(),
                    'time_slot'  => (int) $l->time_slot,
                    'status'     => $l->status,
                    'rating'     => $l->rating,
                    'checked_at' => optional($l->checked_at)->toDateTimeString(),
                ];
            })
            ->values();

        return response()->json([
            'logs'  => $logs,
            'start' => $start,
            'end'   => $end,
        ]);
    }

    /* ============================================================
     * GET /api/weekly-board
     * Weekタブ：一括ロード
     * ============================================================*/
    public function weeklyBoard(Request $req): JsonResponse
    {
        $userId = Auth::id();
        [$start, $end] = $this->weekRange($req);

        /* -------------------------
         * 1) 習慣一覧（完全版）
         * -------------------------*/
        $habits = Habit::where('user_id', $userId)
            ->get()
            ->map(function (Habit $h) {
                return [
                    'id'              => (int) $h->id,
                    'title'           => $h->title,
                    'time_slot'       => (int) ($h->time_slot ?? 0),
                    'start_date'      => optional($h->start_date)->toDateString(),
                    'end_date'        => optional($h->end_date)->toDateString(),
                    'frequency_type'  => $h->frequency_type,
                    'days_of_week'    => $h->normalizedDaysOfWeek(),
                    'evaluation_type' => $h->evaluation_type,
                ];
            })
            ->values();

        /* -------------------------
         * 2) days[]（7日分）
         * -------------------------*/
        $today = Carbon::today();

        $days = collect(range(0, 6))->map(function ($i) use ($start, $today) {
            $d = $start->copy()->addDays($i);

            return [
                'iso'      => $d->toDateString(),
                'd'        => (int) $d->format('d'),
                'label'    => ['月','火','水','木','金','土','日'][$d->dayOfWeekIso - 1],
                'isToday'  => $d->isSameDay($today),
                'isFuture' => $d->isFuture(),
            ];
        })->values();

        /* -------------------------
         * 3) checks[]（全 HabitLog）
         * -------------------------*/
        $checks = HabitLog::where('user_id', $userId)
            ->whereBetween('date', [$start, $end])
            ->get()
            ->map(function (HabitLog $l) {
                return [
                    'habit_id'   => (int) $l->habit_id,
                    'date'       => Carbon::parse($l->date)->toDateString(),
                    'time_slot'  => (int) $l->time_slot,
                    'status'     => $l->status,
                    'rating'     => $l->rating,
                    'checked_at' => optional($l->checked_at)->toDateTimeString(),
                ];
            })
            ->values();

        /* -------------------------
         * 4) scheduled_by_date
         * -------------------------*/
        $scheduled = [];
        foreach (range(0, 6) as $i) {
            $d = $start->copy()->addDays($i);
            $dateStr = $d->toDateString();

            $ids = Habit::where('user_id', $userId)
                ->get()
                ->filter(fn ($h) => $h->isScheduledFor($d, null))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all();

            $scheduled[$dateStr] = $ids;
        }

        /* -------------------------
         * 5) Weekly rate
         * -------------------------*/
        [$list, $rates] = $this->computeWeeklyRates($req);

        /* -------------------------
         * 6) rows（WeeklyBoard の本体）
         * -------------------------*/
        $rows = $habits->map(function ($habit) use ($days, $checks) {

            // habit_id 単位の check map を作る
            $checkMap = [];
            foreach ($checks as $c) {
                if ($c['habit_id'] === $habit['id']) {
                    $checkMap[$c['date']] = $c['status'];
                }
            }

            $cells = collect($days)->map(function ($d) use ($checkMap) {
                $date = $d['iso'];

                return [
                    'date'   => $date,
                    'status' => $checkMap[$date] ?? null,
                    'isDone' => ($checkMap[$date] ?? null) === 'done',
                ];
            });

            return [
                'habit_id'    => $habit['id'],
                'habit_title' => $habit['title'],
                'cells'       => $cells,
                'time_slot'   => $habit['time_slot'],             // ← 超重要
                'days_of_week'=> $habit['days_of_week'],          // ← スケジュール判定用
                'frequency_type'=> $habit['frequency_type'],
                'start_date'  => $habit['start_date'],
                'end_date'    => $habit['end_date'],
            ];
        })->values();

        /* -------------------------
         * 7) 最終 JSON
         * -------------------------*/
        $rangeLabel = $start->format('n/j') . ' ~ ' . $end->format('n/j');

        return response()->json([
            'days'              => $days,
            'habits'            => $habits,
            'scheduled_by_date' => $scheduled,
            'checks'            => $checks,
            'rates'             => $rates,
            'range_label'       => $rangeLabel,

            'week_start'        => $start->toDateString(),
            'week_end'          => $end->toDateString(),

            'rows'              => $rows,   // WeeklyBoard のメイン
        ]);
    }

    /* ============================================================
     * 内部ユーティリティ：週次達成率
     * ============================================================*/
    private function computeWeeklyRates(Request $req): array
    {
        $userId = Auth::id();
        [$start, $end] = $this->weekRange($req);

        $slot = (int) $req->query('time_slot', 0);
        $planSlot = ($slot === 0) ? null : $slot;

        $dates = collect(range(0, 6))
            ->map(fn ($i) => $start->copy()->addDays($i)->toDateString());

        $habits = Habit::where('user_id', $userId)->get([
            'id',
            'start_date',
            'end_date',
            'frequency_type',
            'days_of_week',
            'time_slot',
            'archived',
        ]);

        // done 集計
        $q = DB::table('habit_logs')
            ->where('user_id', $userId)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()]);

        if ($slot !== 0) {
            $q->where('time_slot', $slot);
        }

        $rows = $q->select(
                'habit_id',
                'date',
                DB::raw("MAX(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done")
            )
            ->groupBy('habit_id', 'date')
            ->get();

        $doneMap = [];
        foreach ($rows as $r) {
            $doneMap[$r->habit_id . '|' . Carbon::parse($r->date)->toDateString()] =
                ((int) $r->done) === 1;
        }

        $list  = [];
        $rates = [];

        foreach ($dates as $d) {
            $dateObj = Carbon::parse($d);

            $plannedIds = $habits
                ->filter(fn (Habit $h) => $h->isScheduledFor($dateObj, $planSlot))
                ->pluck('id')
                ->all();

            $den = count($plannedIds);
            if ($den === 0) {
                $list[]  = ['date' => $d, 'rate' => 0];
                $rates[] = 0;
                continue;
            }

            $num = 0;
            foreach ($plannedIds as $hid) {
                if (!empty($doneMap[$hid . '|' . $d])) {
                    $num++;
                }
            }

            $rate = (int) round(($num * 100) / $den);
            $list[] = ['date' => $d, 'rate' => $rate];
            $rates[] = $rate;
        }

        return [$list, $rates, $slot, $start];
    }
}