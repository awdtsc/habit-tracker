<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Carbon\Carbon;

class HabitTime extends Model
{
    use HasFactory;

    protected $fillable = [
        'habit_id',
        'time_slot',     // ★ 追加（0=anytime, 1=朝, 2=昼, 3=夕, 4=夜）
        'notify_time',   // HH:MM 形式で保存
        'label',         // 任意: 朝/夜などのラベル（不要なら省略可）
        'remind_offset', // 通知を早め/遅らせたい場合の分オフセット
    ];

    protected $casts = [
        'time_slot'     => 'integer',  // ★ キャストも追加
        'notify_time'   => 'string',   // DBは TIME 型想定
        'remind_offset' => 'integer',
    ];

    /* ===== リレーション ===== */

    public function habit()
    {
        return $this->belongsTo(Habit::class);
    }

    public function logs()
    {
        return $this->hasMany(HabitLog::class);
    }

    /* ===== ユーティリティ ===== */

    /**
     * 今日の日付に結合した Carbon インスタンスを返す
     */
    public function asCarbonToday(): Carbon
    {
        // notify_time が "HH:MM" or "HH:MM:SS" のどちらでも対応
        $parts = explode(':', $this->notify_time);
        $h = (int)($parts[0] ?? 0);
        $m = (int)($parts[1] ?? 0);
        $s = (int)($parts[2] ?? 0);

        $c = Carbon::today()->setTime($h, $m, $s);

        // オフセットを考慮（例: 5分前に通知）
        if ($this->remind_offset) {
            $c = $c->copy()->addMinutes((int)$this->remind_offset);
        }

        return $c;
    }

    /**
     * 現在時刻が通知対象かを判定
     */
    public function isDue(Carbon $now, int $toleranceMinute = 1): bool
    {
        $target = $this->asCarbonToday();
        $diff   = $now->diffInMinutes($target, false);
        return abs($diff) <= $toleranceMinute;
    }
}