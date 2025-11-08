<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * PushSubscription
 *
 * Web Push の購読情報（端末ごとに 1 件を想定）
 * - endpoint は長い URL になるため TEXT。重複防止は endpoint_hash(sha256) の UNIQUE で担保
 * - user_id 必須。ユーザー削除時は CASCADE を推奨（migration 側）
 */
class PushSubscription extends Model
{
    protected $table = 'push_subscriptions';

    /**
     * 明示フィルアブル（guarded=[] ではなく、受け入れる項目を限定）
     */
    protected $fillable = [
        'user_id',
        'endpoint',
        'endpoint_hash',
        'p256dh',
        'auth',
        'content_encoding',
        'device',
        'user_agent',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    /**
     * 保存時に endpoint_hash を自動計算（endpoint が空の場合はそのまま）
     */
    protected static function booted(): void
    {
        static::saving(function (self $model) {
            if (isset($model->endpoint)) {
                $endpoint = trim((string) $model->endpoint);
                $model->endpoint = $endpoint;
                if ($endpoint !== '') {
                    $model->endpoint_hash = hash('sha256', $endpoint);
                }
            }
        });
    }

    /**
     * エンドポイント設定時にもハッシュを同期
     */
    public function setEndpointAttribute($value): void
    {
        $value = is_string($value) ? trim($value) : $value;
        $this->attributes['endpoint'] = $value;
        if ($value) {
            $this->attributes['endpoint_hash'] = hash('sha256', $value);
        }
    }

    /**
     * 所有ユーザー
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * スコープ: 指定ユーザーの購読
     */
    public function scopeOfUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Web Push の subscribe() で得られるペイロードから Upsert
     * $payload 例:
     *  {
     *    endpoint: "...",
     *    keys: { p256dh: "...", auth: "..." },
     *    contentEncoding: "aes128gcm" // or content_encoding
     *  }
     */
    public static function upsertFromWebPush(int $userId, array $payload): self
    {
        $endpoint = trim((string)($payload['endpoint'] ?? ''));
        $hash = $endpoint ? hash('sha256', $endpoint) : null;

        return static::updateOrCreate(
            ['endpoint_hash' => $hash],
            [
                'user_id'          => $userId,
                'endpoint'         => $endpoint,
                'p256dh'           => (string)($payload['keys']['p256dh'] ?? $payload['p256dh'] ?? ''),
                'auth'             => (string)($payload['keys']['auth'] ?? $payload['auth'] ?? ''),
                'content_encoding' => (string)($payload['contentEncoding'] ?? $payload['content_encoding'] ?? 'aes128gcm'),
                'device'           => $payload['device'] ?? null,
                'user_agent'       => $payload['userAgent'] ?? $payload['user_agent'] ?? request()->userAgent(),
                'last_used_at'     => now(),
            ]
        );
    }

    /**
     * 最終利用時刻を更新（通知送信後などに呼ぶ）
     */
    public function markUsed(): void
    {
        $this->last_used_at = now();
        $this->saveQuietly();
    }
}