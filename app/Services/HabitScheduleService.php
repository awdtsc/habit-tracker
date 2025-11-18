<?php

namespace App\Services;

use App\Models\Habit;
use Carbon\Carbon;

class HabitScheduleService
{
    /**
     * 「この日がこの習慣の実行対象日か？」だけを見る。
     *
     * - start_date / end_date の範囲チェック
     * - frequency_type（daily / weekly / weekday など）
     * - days_of_week（[1=Mon..7=Sun]）
     */
    public function isPlannedOnDate(Habit $habit, Carbon $date): bool
    {
        // --- 日付範囲 ---
        if ($habit->start_date) {
            $start = Carbon::parse($habit->start_date)->startOfDay();
            if ($date->lt($start)) {
                return false;
            }
        }

        if ($habit->end_date) {
            $end = Carbon::parse($habit->end_date)->endOfDay();
            if ($date->gt($end)) {
                return false;
            }
        }

        // --- 頻度 ---
        $freq = $habit->frequency_type ?? 'daily';
        $dow  = (int) $date->isoWeekday(); // 1=Mon..7=Sun
        $days = $this->normalizeDaysOfWeek($habit->days_of_week ?? null);

        switch ($freq) {
            case 'weekly':
                // days_of_week が設定されていれば、その曜日だけ。
                // 未設定なら「毎日扱い」に寄せて事故を防ぐ。
                if (!empty($days)) {
                    return in_array($dow, $days, true);
                }
                return true;

            case 'weekday':
                // 月〜金だけ
                return $dow >= 1 && $dow <= 5;

            case 'daily':
            default:
                // daily / 未設定 / 未知の値 → 毎日
                return true;
        }
    }

    /**
     * 「この日時にこの習慣が実行対象か？」
     *
     * 日付判定 ＋ 時間帯判定 を合成した“フル版”。
     * 古いコードとの互換用に残しておく。
     */
    public function isScheduledFor(Habit $habit, Carbon $dateTime): bool
    {
        if (! $this->isPlannedOnDate($habit, $dateTime)) {
            return false;
        }

        return $this->matchTimeSlot($habit, $dateTime);
    }

    /**
     * 時間帯で判定。
     *
     * 優先順位:
     *   1. habit_times（$habit->times）があれば、その time_slot 群を正とする
     *   2. なければ habits.time_slot を見る
     *   3. どちらも無ければ anytime（終日対象）
     */
    private function matchTimeSlot(Habit $habit, Carbon $dateTime): bool
    {
        $currentSlot = $this->resolveSlotFromTime($dateTime);

        // 1. 複数時間帯が定義されている場合（habit_times 優先）
        if ($habit->relationLoaded('times') && $habit->times->isNotEmpty()) {
            $slots = $habit->times
                ->pluck('time_slot')
                ->map(fn ($v) => (int) $v)
                ->all();

            // どれか一致していればOK。0(anytime)が含まれていれば常にOK。
            if (in_array(0, $slots, true)) {
                return true;
            }

            return in_array($currentSlot, $slots, true);
        }

        // 2. 単一 time_slot カラム
        $slot = (int) ($habit->time_slot ?? 0);

        // 0 = anytime（時間帯指定なし）は常に対象
        if ($slot === 0) {
            return true;
        }

        return $slot === $currentSlot;
    }

    /**
     * days_of_week を [1,3,5] 形式の配列に正規化。
     */
    private function normalizeDaysOfWeek($raw): array
    {
        if (is_array($raw)) {
            $values = $raw;
        } elseif (is_string($raw) && $raw !== '') {
            // "1,3,5" → [1,3,5]
            $values = preg_split('/\s*,\s*/', $raw);
        } else {
            return [];
        }

        return array_values(
            array_filter(
                array_map('intval', $values),
                fn ($v) => $v >= 1 && $v <= 7
            )
        );
    }

    /**
     * 時刻からスロットコードを算出。
     *
     * config/habits.php に slots 設定があればそちらを優先。
     */
    private function resolveSlotFromTime(Carbon $dateTime): int
    {
        $h = (int) $dateTime->format('H');

        // デフォルト設定（config/habits.php が無い場合のフォールバック）
        $defaultSlots = [
            'morning' => ['code' => 1, 'start' => 5,  'end' => 10],
            'noon'    => ['code' => 2, 'start' => 11, 'end' => 16],
            'evening' => ['code' => 3, 'start' => 17, 'end' => 20],
            'night'   => ['code' => 4, 'start' => 21, 'end' => 4], // 21:00–23:59, 00:00–04:59
        ];

        $slots = config('habits.slots', $defaultSlots);

        foreach ($slots as $slot) {
            $code  = (int) ($slot['code'] ?? 0);
            $start = (int) ($slot['start'] ?? 0);
            $end   = (int) ($slot['end'] ?? 23);

            if ($code === 0) {
                continue;
            }

            // 日付をまたがないパターン（例: 5〜10時）
            if ($start <= $end) {
                if ($h >= $start && $h <= $end) {
                    return $code;
                }
            } else {
                // 日付をまたぐパターン（例: 21〜4時）
                if ($h >= $start || $h <= $end) {
                    return $code;
                }
            }
        }

        // どのスロットにも当てはまらないなら 0（anytime）扱い
        return 0;
    }
}