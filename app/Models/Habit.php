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
    ];

    protected $casts = [
        'days_of_week' => 'array',
        'start_date'   => 'date',
        'end_date'     => 'date',
    ];

    /** 指定日が予定日か（後方互換：未設定は“毎日”扱い） */
    public function isScheduledFor(Carbon $date): bool
    {
        if (!empty($this->start_date) && $date->lt(Carbon::parse($this->start_date)->startOfDay())) return false;
        if (!empty($this->end_date)   && $date->gt(Carbon::parse($this->end_date)->endOfDay()))   return false;

        $type = $this->frequency_type ? strtolower((string)$this->frequency_type) : null;
        $days = $this->days_of_week ?? [];

        if (!$type && (empty($days) || $days === [])) return true; // 後方互換

        if (in_array($type, ['everyday','daily'], true)) return true;

        $dow = (int)$date->isoWeekday(); // 1..7 Mon..Sun
        if ($type === 'weekdays') return in_array($dow, [1,2,3,4,5], true);
        if ($type === 'weekends') return in_array($dow, [6,7], true);

        if (!is_array($days)) $days = (array)$days;
        $days = array_map('intval', $days);
        return in_array($dow, $days, true);
    }
}