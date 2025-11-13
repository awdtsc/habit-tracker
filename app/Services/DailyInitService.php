<?php

namespace App\Services;

use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * DailyInitService
 *
 * 役割：
 *  - “指定日”の HabitLog をスロット単位で冪等に用意するコアロジックを提供
 *  - Console(Command) や Scheduler、Controller から再利用されるサービス層
 *
 * ポリシー：
 *  - ユニークキーは (habit_id, date, time_slot) を前提
 *  - 空ログ（status='none'）を作る運用を採用（必要ならトグルで停止可）
 */
class DailyInitService
{
    /** 空ログの自動生成を有効にする（false で一時停止可能） */
    private const ENABLE_EMPTY_LOGS = true;

    /**
     * 指定日について、ユーザー単位（任意）で HabitLog を冪等に生成する。
     *
     * @param  Carbon     $date     JST基準で扱う対象日
     * @param  int|null   $userId   特定ユーザーに限定する場合のみ指定
     * @return array{date:string,candidates:int,inserted:int,skipped:int}
     */
    public function initForDate(Carbon $date, ?int $userId = null): array
    {
        $tz   = config('app.timezone', 'Asia/Tokyo');
        $day  = $date->copy()->timezone($tz)->startOfDay();
        $w    = (int) $day->isoWeekday(); // 1=Mon .. 7=Sun

        if (!self::ENABLE_EMPTY_LOGS) {
            $result = ['date' => $day->toDateString(), 'candidates' => 0, 'inserted' => 0, 'skipped' => 0];
            Log::info('[DailyInitService] empty log generation disabled', $result + ['user_id' => $userId]);
            return $result;
        }

        $habits = Habit::query()
            ->when($userId, fn($q) => $q->where('user_id', $userId))
            ->with('habitTimes') // hasMany HabitTime(time_slot, etc.)
            ->get();

        $candidates = 0;
        $inserted   = 0;
        $skipped    = 0;

        foreach ($habits as $habit) {
            if (!$this->isScheduledOn($habit, $w)) {
                continue;
            }

            foreach ($habit->habitTimes as $ht) {
                $candidates++;

                // 冪等： (habit_id, date, time_slot) で重複作成しない
                $log = HabitLog::updateOrCreate(
                    [
                        'habit_id'  => $habit->id,
                        'date'      => $day->toDateString(),
                        'time_slot' => (int) $ht->time_slot,
                    ],
                    [
                        'user_id'       => $habit->user_id,
                        'habit_time_id' => $ht->id,
                        'status'        => 'none',
                        'rating'        => null,
                        'checked_at'    => null,
                        'note'          => null,
                    ]
                );

                $log->wasRecentlyCreated ? $inserted++ : $skipped++;
            }
        }

        $summary = [
            'date'       => $day->toDateString(),
            'candidates' => $candidates,
            'inserted'   => $inserted,
            'skipped'    => $skipped,
        ];

        Log::info('[DailyInitService] initForDate summary', $summary + ['user_id' => $userId]);

        return $summary;
    }

    /**
     * 互換API：文字列引数中心の呼び出し元（旧コード）に対応。
     * - $habitId が与えられた場合は、その Habit の user_id 毎に init を行う
     *   （同一ユーザーであれば1回の init で十分なため、user_id を抽出して集約）
     *
     * @param string|null         $date    'YYYY-MM-DD'（未指定は JST の今日）
     * @param string|null         $now     'YYYY-MM-DD HH:MM:SS'（ログ用途のみ）
     * @param int|array<int>|null $habitId 特定 Habit に限定したい場合のみ
     */
    public function run(?string $date = null, ?string $now = null, int|array|null $habitId = null): void
    {
        $tz  = config('app.timezone', 'Asia/Tokyo');
        $day = $date ? Carbon::parse($date, $tz) : Carbon::now($tz);
        $day->startOfDay();

        // 限定がなければ全体をそのまま処理
        if (is_null($habitId)) {
            $this->initForDate($day, null);
            Log::info('[DailyInitService] run(all)', ['date' => $day->toDateString(), 'now' => $now]);
            return;
        }

        // Habit ID リストを正規化
        $ids = is_array($habitId) ? array_values(array_unique(array_map('intval', $habitId))) : [(int) $habitId];

        // 対象 Habit の user_id を抽出してユーザー単位で init（重複排除）
        $userIds = Habit::query()->whereIn('id', $ids)->pluck('user_id')->unique()->values();

        foreach ($userIds as $uid) {
            $this->initForDate($day, (int) $uid);
        }

        Log::info('[DailyInitService] run(by-habits)', [
            'date'    => $day->toDateString(),
            'now'     => $now,
            'habitId' => $ids,
            'userIds' => $userIds,
        ]);
    }

    /**
     * 単一 Habit をトリガとして呼ばれた場合のショートカット。
     */
    public function initHabitForDate(Habit $habit, ?string $date = null, ?string $now = null): void
    {
        $tz  = config('app.timezone', 'Asia/Tokyo');
        $day = $date ? Carbon::parse($date, $tz) : Carbon::now($tz);
        $day->startOfDay();

        $this->initForDate($day, (int) $habit->user_id);

        Log::info('[DailyInitService] initHabitForDate', [
            'habit_id' => $habit->id,
            'user_id'  => $habit->user_id,
            'date'     => $day->toDateString(),
            'now'      => $now,
        ]);
    }

    /**
     * その習慣が当該曜日に実行対象かを判定する（最低限のサンプル実装）
     * - habits.frequency_type: 'daily' / 'weekly'（未設定は daily 扱い）
     * - habits.days_of_week: "1,3,5" 形式 or 配列（1=Mon..7=Sun）
     */
    protected function isScheduledOn(object $habit, int $weekday): bool
    {
        $type = $habit->frequency_type ?? 'daily';

        if ($type === 'daily') {
            return true;
        }

        if ($type === 'weekly' || isset($habit->days_of_week)) {
            $days = $this->normalizeDays($habit->days_of_week ?? []);
            return in_array($weekday, $days, true);
        }

        // 情報不足時は安全側（実行）に倒す
        return true;
    }

    /** "1,3,5" / [1,3,5] / " 1 3 5 " を配列[int]に正規化 */
    protected function normalizeDays(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('intval', $value)));
        }
        if (is_string($value)) {
            return array_values(array_filter(array_map('intval', preg_split('/[,\s]+/', trim($value)) ?: [])));
        }
        return [];
    }
}