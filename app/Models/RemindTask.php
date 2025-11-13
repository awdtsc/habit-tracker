<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RemindTask extends Model
{
    use HasFactory;

    /** 状態（enumは使わない） */
    public const STATUS_PENDING   = 'pending';
    public const STATUS_SENT      = 'sent';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_SKIPPED   = 'skipped';
    public const STATUS_DONE      = 'done';
    public const STATUS_ERROR     = 'error';

    /** 直書き作成にも対応できるよう FK も許可 */
    protected $fillable = [
        'habit_log_id',
        'parent_task_id',
        'remind_at',
        'reschedule',
        'status',
    ];

    /** reschedule は JSON 配列として扱う（履歴やスヌーズ回数の拡張に備える） */
    protected $casts = [
        'remind_at'  => 'datetime',
        'reschedule' => 'array',   // JSON⇄配列を自動変換
        'status'     => 'string',
    ];

    /** 既定値：pending / reschedule は空配列（文字列JSONで保持して安全側に） */
    protected $attributes = [
        'status'     => self::STATUS_PENDING,
        'reschedule' => '[]',
    ];

    /* =========================
     | リレーション
     * ========================= */

    public function habitLog()
    {
        return $this->belongsTo(HabitLog::class, 'habit_log_id');
    }

    public function parentTask()
    {
        return $this->belongsTo(self::class, 'parent_task_id');
    }

    public function childTasks()
    {
        return $this->hasMany(self::class, 'parent_task_id');
    }

    /* =========================
     | アクセサ / ヘルパ
     * ========================= */

    public function getHabitAttribute()
    {
        return $this->habitLog?->habit;
    }

    public function getOwnerUserIdAttribute(): ?int
    {
        return $this->habitLog?->habit?->user_id;
    }

    public function getOwnerUserAttribute()
    {
        return $this->habitLog?->habit?->user;
    }

    /* =========================
     | スコープ
     * ========================= */

    public function scopeDuePending($query)
    {
        return $query
            ->where('status', self::STATUS_PENDING)
            ->where('remind_at', '<=', now());
    }

    public function scopeFuturePending($query)
    {
        return $query
            ->where('status', self::STATUS_PENDING)
            ->where('remind_at', '>', now());
    }

    public function scopeStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->whereHas('habitLog.habit', fn ($q) => $q->where('user_id', $userId));
    }

    /* =========================
     | ドメイン操作ヘルパ
     * ========================= */

    public function markSent(): void
    {
        $this->status = self::STATUS_SENT;
        $this->save();
    }

    public function markSkipped(): void
    {
        $this->status = self::STATUS_SKIPPED;
        $this->save();
    }

    public function cancel(): void
    {
        $this->status = self::STATUS_CANCELLED;
        $this->save();
    }

    public function complete(): void
    {
        $this->status = self::STATUS_DONE;
        $this->save();
    }

    public function markError(): void
    {
        $this->status = self::STATUS_ERROR;
        $this->save();
    }
}
