<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Habit extends Model
{
    use HasFactory;

    /**
     * NOTE:
     * - 既存コード/Factory 互換のため name <-> title のブリッジを用意
     *   - setNameAttribute() で渡された name を title に保存
     *   - getNameAttribute() で title を name として参照可能
     */

    protected $fillable = [
        'user_id',
        'title',            // 正式フィールド（name は setter で吸収）
        'description',
        'frequency_type',
        'days_of_week',
        'start_date',
        'end_date',
        'archived',
        'time_slot',        // 0=終日, 1..=特定スロット（複数は habit_times 側）
        'category',
        'color_tag',
        'target_times',
        'evaluation_type',
    ];

    protected $casts = [
        'days_of_week'    => 'array',
        'target_times'    => 'array',
        'start_date'      => 'date',
        'end_date'        => 'date',
        'archived'        => 'boolean',
        'time_slot'       => 'integer',
        'evaluation_type' => 'string',
    ];

    /* =========================
     |  リレーション
     * ========================= */

    // 複数通知時刻（habit_times）
    public function habitTimes()
    {
        return $this->hasMany(HabitTime::class);
    }

    // 互換用エイリアス（将来は habitTimes に統一推奨）
    public function times()
    {
        return $this->habitTimes();
    }

    // 習慣ログ
    public function logs()
    {
        return $this->hasMany(HabitLog::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /* =========================
     |  スケジュール判定
     * ========================= */

    /**
     * 指定日（必要なら time_slot も）にこの習慣が予定されているか。
     * $slot: null=日単位判定, 0=終日, 1..=特定スロット
     */
    public function isScheduledFor(Carbon $date, ?int $slot = null): bool
    {
        $timezone = config('app.timezone', 'Asia/Tokyo');
        $dateJst  = $date->copy()->setTimezone($timezone);

        // アーカイブ & 期間チェック（含む）
        if ($this->archived ?? false) {
            return false;
        }
        if (!empty($this->start_date) && $dateJst->lt(Carbon::parse($this->start_date, $timezone)->startOfDay())) {
            return false;
        }
        if (!empty($this->end_date) && $dateJst->gt(Carbon::parse($this->end_date, $timezone)->endOfDay())) {
            return false;
        }

        // 頻度タイプ
        $type = $this->frequency_type ? strtolower((string) $this->frequency_type) : null;

        // 週クオータは「期間内ならいつでも可」
        if ($type === 'quota') {
            return true;
        }

        // 既存ロジック（毎日/平日/週末/カスタム）
        if (in_array($type, ['everyday', 'daily'], true)) {
            // OK
        } elseif ($type === 'weekdays') {
            $dow = (int) $dateJst->isoWeekday(); // 1..7
            if (!in_array($dow, [1,2,3,4,5], true)) return false;
        } elseif ($type === 'weekends') {
            $dow = (int) $dateJst->isoWeekday();
            if (!in_array($dow, [6,7], true)) return false;
        } else {
            // weekly/custom/未設定 は days_of_week を参照
            $days = $this->normalizedDaysOfWeek(); // ISO: 1..7
            if (!$type && empty($days)) {
                // タイプ未設定＆曜日未指定は「毎日」扱い
            } else {
                $dow = (int) $dateJst->isoWeekday();
                if (!in_array($dow, $days, true)) return false;
            }
        }

        // time_slot チェック
        $ts = (int) ($this->time_slot ?? 0); // 0=終日/制約なし
        if ($ts === 0) return true;
        // $slot が与えられていなければ「日単位OK」、与えられていれば一致を要求
        return $slot === null || $slot === $ts;
    }

    /**
     * days_of_week を ISO-8601 (1=Mon..7=Sun) に正規化。
     * - 許容入力:
     *   - 配列: [1,3,5] / [0,1,2]（0=Sun → 7へ補正）
     *   - 文字列: "1,3,5" / "0130110"(bit) / "[1,3,5]"(JSON)
     *   - 数値: bitmask (<= 2^7-1) など
     */
    public function normalizedDaysOfWeek(): array
    {
        $raw = $this->getAttribute('days_of_week');

        if (is_null($raw) || $raw === '') {
            return [];
        }

        if (is_array($raw)) {
            $values = $raw;
        } elseif (is_string($raw)) {
            $values = $this->parseDaysOfWeekString($raw);
        } elseif (is_int($raw)) {
            $values = $this->daysFromBitmask($raw);
        } else {
            $values = (array) $raw;
        }

        $normalized = [];
        foreach ($values as $value) {
            if (is_string($value) && str_contains($value, ',')) {
                foreach (explode(',', $value) as $piece) {
                    $normalized[] = $this->normalizeDayValue(trim($piece));
                }
                continue;
            }
            $normalized[] = $this->normalizeDayValue($value);
        }

        $normalized = array_values(array_unique(array_filter($normalized)));
        sort($normalized);

        return $normalized;
    }

    private function parseDaysOfWeekString(string $value): array
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return [];
        }

        // JSON array "[1,3,5]"
        if ($trimmed[0] === '[') {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // "1,3,5"
        if (str_contains($trimmed, ',')) {
            return array_map('trim', explode(',', $trimmed));
        }

        // bit string "0110010"
        if (preg_match('/^[01]{7}$/', $trimmed)) {
            return $this->daysFromBitString($trimmed);
        }

        // numeric (bitmask or single)
        if (is_numeric($trimmed)) {
            $int  = (int) $trimmed;
            $days = $this->daysFromBitmask($int);
            if (!empty($days)) {
                return $days;
            }
            return [$int];
        }

        return [$trimmed];
    }

    private function normalizeDayValue(mixed $value): ?int
    {
        if (is_numeric($value)) {
            $int = (int) $value;
            if ($int >= 1 && $int <= 7) {
                return $int;
            }
            if ($int >= 0 && $int <= 6) {
                return $this->mapLegacyDow($int);
            }
        }
        return null;
    }

    private function daysFromBitString(string $bits): array
    {
        $bits = str_pad(substr($bits, -7), 7, '0', STR_PAD_LEFT);
        $days = [];
        foreach (str_split($bits) as $index => $bit) {
            if ($bit === '1') {
                $days[] = $this->mapLegacyDow($index);
            }
        }
        sort($days);

        return $days;
    }

    private function daysFromBitmask(int $mask): array
    {
        if ($mask <= 0) {
            return [];
        }

        $days = [];
        for ($bit = 0; $bit <= 6; $bit++) {
            if ($mask & (1 << $bit)) {
                $days[] = $this->mapLegacyDow($bit);
            }
        }
        sort($days);

        return $days;
    }

    /** 旧式 0..6（0=Sun）→ ISO 1..7 に変換 */
    private function mapLegacyDow(int $value): int
    {
        return match ($value) {
            0 => 7, // Sunday
            1 => 1,
            2 => 2,
            3 => 3,
            4 => 4,
            5 => 5,
            6 => 6,
            7 => 7,
            default => $value,
        };
    }

    /* =========================
     |  ヘルパー
     * ========================= */

    /**
     * 今日の通知時刻一覧（Carbon[]）を返す。
     * ※ HabitTime::notify_time が 'H:i' 文字列で保存されている前提。
     */
    public function todayNotifyTimes(): array
    {
        return $this->habitTimes
            ->filter(fn ($t) => !empty($t->notify_time))
            ->map(function ($t) {
                try {
                    return Carbon::createFromFormat('H:i', (string) $t->notify_time);
                } catch (\Throwable) {
                    return null;
                }
            })
            ->filter()
            ->values()
            ->all();
    }

    /* =========================
     |  互換: name <-> title
     * ========================= */

    // Factoryや既存コードが name を使っていても title に保存する
    public function setNameAttribute($value): void
    {
        $this->attributes['title'] = $value;
    }

    // title を name として参照可能にする
    public function getNameAttribute(): ?string
    {
        return $this->attributes['title'] ?? null;
    }
}