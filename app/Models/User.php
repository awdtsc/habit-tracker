<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, HasPushSubscriptions;

    /**
     * 一括代入を許可するカラム
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * レスポンスに含めない属性
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * キャスト
     *
     * ※ password の自動ハッシュは切っておく
     *    -> tinkerで手動でbcryptしたいときに二重ハッシュにならないようにするため
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        // 'password' => 'hashed',  ← 今回はあえて外す
    ];

    /**
     * WebPush チャネルのルーティング
     */
    public function routeNotificationForWebPush()
    {
        return $this->pushSubscriptions;
    }
}