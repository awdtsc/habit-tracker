<?php

namespace App\Http\Middleware;

use Illuminate\Cookie\Middleware\EncryptCookies as Middleware;

class EncryptCookies extends Middleware
{
    /**
     * 暗号化しないクッキー名
     * 通常は空でOK。XSRF-TOKENもLaravelがうまくやる。
     */
    protected $except = [
        //
    ];
}