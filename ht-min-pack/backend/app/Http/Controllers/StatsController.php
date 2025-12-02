<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\RemindTask;

class StatsController extends Controller
{
    /** ?start=YYYY-MM-DD を月曜起点に正規化して [start,end] を返す */
    private function weekRange(Request $req): array
    {
        $start = $req->query('start')
            ? Carbon::parse($req->query('start'))->startOfDay()
            : Carbon::now()->startOfDay();

        $w = $start->isoWeekday();
        if ($w !== 1) {
            $start->subDays($w - 1); // 月曜始まり
        }
        $end = $start->copy()->addDays(6);
        return [$start, $end];
    }

    /**
     * 週の日別達成率（0-100 の整数%）
     * GET /api/achievement/weekly?start=YYYY-MM-DD&time_slot=N
     */
    public function weeklyByDay(Request $req): JsonResponse
    {
        [$list, $rates, $slot, $start] = $this->computeWeeklyRates($req);
        return response()->json([
            'list'      => $list,
            'rates'     => $rates,
            'time_slot' => $slot,
            'start'     => $start->toDateString(),
        ]);
    }

    /**
     * weekly board: habits / checks / rates 一括
     * GET /api/weekly-board
     */
    public function weeklyBoard(Request $req): JsonResponse
    {
        $userId = Auth::id();
        [$start, $end] = $this->weekRange($req);

        // 習慣
        $habits = Habit::where('user_id', $userId)
            ->get([
                'id','title','description',
                'frequency_type','days_of_week',
                'start_date','end_date',
                'time_slot','category','color_tag',
                'evaluation_type',
            ])
            ->map(function ($h) {
                return [
                    'id'             => (int)$h->id,
                    'title'          => $h->title,
                    'description'    => $h->description,
                    'frequency_type' => $h->frequency_type,
                    'days_of_week'   => is_array($h->days_of_week) ? $h->days_of_week : (array)$h->days_of_week,
                    'start_date'     => optional($h->start_date)->toDateString(),
                    'end_date'       => optional($h->end_date)->toDateString(),
                    'time_slot'      => $h->time_slot,
                    'category'       => $h->category,
                    'color_tag'      => $h->color_tag,
                    'evaluation_type'=> $h->evaluation_type ?? 'simple',
                ];
            })->values();

        if ($habits->isEmpty()) {
            return response()->json([
                'habits' => [],
                'checks' => [],
                'rates'  => [],
            ]);
        }

        // 今週ログ
        $logs = HabitLog::whereBetween('date', [$start, $end])
            ->where('user_id', $userId)
            ->get(['habit_id', 'date', 'time_slot', 'status', 'rating', 'checked_at']);

        $checks = $logs->map(fn($l) => [
            'habit_id'   => (int)$l->habit_id,
            'date'       => Carbon::parse($l->date)->toDateString(),
            'time_slot'  => (int)$l->time_slot,
            'value'      => $l->status === 'done',                         // 文字列で判定
            'rating'     => $l->rating,
            'checked_at' => optional($l->checked_at)->toDateTimeString(),  // UI 用
        ])->values();

        // 達成率
        [$list, $rates] = $this->computeWeeklyRates($req);

        return response()->json([
            'habits' => $habits,
            'checks' => $checks,
            'rates'  => $rates,
            'list'   => $list,
        ]);
    }

    /**
     * ✅ リマインダー完了:
     * POST /api/reminders/{task}/done
     *  - 完了は habit_logs: status='done', checked_at=now()（未完→完了時）
     *  - 既に done なら変更せず（checked_at が NULL の場合のみ now() で補完）
     *  - remind_tasks は配送状態（pending/sent/…）を基本維持
     */
    public function markDone(Request $request, RemindTask $task): JsonResponse
    {
        $task->load('habitLog.habit.user');
        $habitLog = $task->habitLog;
        $habit    = $habitLog?->habit;
        $owner    = $habit?->user;

        if (!$habitLog || !$habit || !$owner) {
            return response()->json(['ok' => false, 'message' => 'Invalid task relations'], 422);
        }
        if ($owner->id !== $request->user()->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }

        // すでに完了：checked_at が空なら補完のみ、時刻の上書きはしない
        if ($habitLog->status === 'done') {
            if (empty($habitLog->checked_at)) {
                $habitLog->checked_at = now();
                $habitLog->save();
            }
            return response()->json([
                'ok'        => true,
                'message'   => 'Already completed',
                'task'      => $task->fresh('habitLog'),
                'habit_log' => $habitLog->fresh(),
            ]);
        }

        DB::transaction(function () use ($task, $habitLog) {
            // 未完 → 完了：今回の完了時刻に更新
            $habitLog->status     = 'done';
            $habitLog->checked_at = now();
            $habitLog->save();

            // 未送信だったタスクのみ任意で skip（不要なら削除可）
            if ($task->status === 'pending') {
                $task->status = 'skipped';
                $task->save();
            }
        });

        return response()->json([
            'ok'        => true,
            'message'   => 'Marked as done',
            'task'      => $task->fresh('habitLog'),
            'habit_log' => $habitLog->fresh(),
        ]);
    }

    // =========================
    // 内部ユーティリティ
    // =========================

    /**
     * 週次達成率の計算（'done' / 'none' 文字列対応）
     * @return array [$list, $rates, $slot, $startCarbon]
     */
    private function computeWeeklyRates(Request $req): array
    {
        $userId = Auth::id();
        [$start, $end] = $this->weekRange($req);

        // time_slot（0=すべて/終日）
        $slot = (int)$req->query('time_slot', 0);
        // 分母（予定判定）では slot=0 のときは time_slot を無視
        $planSlot = ($slot === 0) ? null : $slot;

        // 今週の各日
        $dates = collect(range(0, 6))
            ->map(fn($i) => $start->copy()->addDays($i)->toDateString());

        // 習慣
        $habits = Habit::where('user_id', $userId)->get([
            'id','title','start_date','end_date','frequency_type','days_of_week','time_slot','archived'
        ]);

        // ログ集計：slot=0 → 全スロット横断で「どれか 'done' があれば1」
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

        // (habit_id|date) → bool のマップ
        $doneMap = [];
        foreach ($rows as $r) {
            $doneMap[$r->habit_id.'|'.Carbon::parse($r->date)->toDateString()] = ((int)$r->done) === 1;
        }

        // 日別の分母/分子→達成率（%）
        $list  = [];
        $rates = [];

        foreach ($dates as $d) {
            $dateObj = Carbon::parse($d);

            // 分母：その日に予定のある習慣（slot=0ならスロット無視 / slot!=0はそのスロットのみ）
            $plannedIds = $habits
                ->filter(fn($h) => $h->isScheduledFor($dateObj, $planSlot))
                ->pluck('id')
                ->all();

            $den = count($plannedIds);
            if ($den === 0) {
                $list[] = ['date' => $d, 'rate' => 0];
                $rates[] = 0;
                continue;
            }

            $num = 0;
            foreach ($plannedIds as $hid) {
                if (!empty($doneMap[$hid.'|'.$d])) $num++;
            }

            $rate   = (int) round(($num * 100) / $den);
            $list[] = ['date' => $d, 'rate' => $rate];
            $rates[] = $rate;
        }

        return [$list, $rates, $slot, $start];
    }
}