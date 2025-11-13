<?php

namespace App\Providers;

use App\Models\RemindTask;
use App\Policies\RemindTaskPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    protected $policies = [
        RemindTask::class => RemindTaskPolicy::class,
    ];

    public function boot(): void
    {
        // 追加設定があればここに
    }
}
