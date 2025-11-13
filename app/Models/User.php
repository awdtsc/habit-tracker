<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany; // 追加
use App\Models\PushSubscription;                    // 追加

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
    // ❌ HasPushSubscriptions は外す
    // use NotificationChannels\WebPush\HasPushSubscriptions;

    protected $fillable = ['name','email','password'];

    protected $hidden = ['password','remember_token'];

    protected $casts = [
        'email_verified_at' => 'datetime',
        // 'password' => 'hashed', // 二重ハッシュ回避で外しておく
    ];

    /**
     * Push 購読（user_id 外部キー）
     */
    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class, 'user_id');
    }

    /**
     * Laravel Notifications の WebPush ルーティング（必要なら）
     * ※ この戻り値はコレクションでOK
     */
    public function routeNotificationForWebPush()
    {
        return $this->pushSubscriptions;
    }
}