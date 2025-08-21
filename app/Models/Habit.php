<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;

class Habit extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','title','description',
        'frequency_type','days_of_week','start_date','end_date',
        'time_slot','category','color_tag','target_times'
    ];

    protected $casts = [
        'days_of_week' => 'array',
        'start_date'   => 'date',
        'end_date'     => 'date',
        'target_times' => 'array',
    ];

    /** 指定日が予定日か（後方互換：未設定は“毎日”扱い） */
    public function isScheduledFor(Carbon $date): bool
    {
        // 期間チェック（含む）
        if (!empty($this->start_date) && $date->lt(Carbon::parse($this->start_date)->startOfDay())) return false;
        if (!empty($this->end_date)   && $date->gt(Carbon::parse($this->end_date)->endOfDay()))   return false;

        $type = $this->frequency_type ? strtolower((string)$this->frequency_type) : null;

        // 週クオータは「期間内ならいつでも可」
        if ($type === 'quota') {
            return true;
        }

        // 既存ロジック（毎日/平日/週末/カスタム）
        if (in_array($type, ['everyday','daily'], true)) return true;

        $dow = (int) $date->isoWeekday(); // 1..7
        if ($type === 'weekdays') return in_array($dow, [1,2,3,4,5], true);
        if ($type === 'weekends') return in_array($dow, [6,7], true);

        $days = $this->days_of_week ?? [];
        if (!is_array($days)) $days = (array) $days;
        $days = array_map('intval', $days);

        // 未指定は「毎日」扱い
        if (!$type && (empty($days) || $days === [])) return true;

        return in_array($dow, $days, true);
    }
}