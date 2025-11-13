<?php

namespace App\Http\Middleware;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Support\Facades\Log;

class Authenticate extends Middleware
{
    /**
     * 未認証時の転送先。API は絶対にリダイレクトさせない。
     */
    protected function redirectTo($request): ?string
    {
        if ($request->is('api/*')) {
            Log::info('[AUTH.redirectTo] api => null', ['path' => $request->path()]);
            return null; // ← ここで null を返すと「例外」経由の 401 へ
        }

        $to = $request->expectsJson() ? null : '/login';
        Log::info('[AUTH.redirectTo] web', [
            'path' => $request->path(),
            'expectsJson' => $request->expectsJson(),
            'to' => $to,
        ]);
        return $to;
    }

    /**
     * ★ 親と同じ署名（$request, array $guards）でオーバーライドすることが重要。
     * ここで例外を投げ、最終レスポンスは Handler に任せる。
     * API なら redirect=null で投げる → 401 JSON
     * 非APIは redirect=/login で投げる → 302
     */
    protected function unauthenticated($request, array $guards)
    {
        $isApi = $request->is('api/*') || $request->expectsJson();
        $redirect = $isApi ? null : '/login';

        Log::info('[AUTH.unauthenticated]', [
            'path' => $request->path(),
            'is_api' => $isApi,
            'redirect' => $redirect,
            'guards' => $guards,
        ]);

        throw new AuthenticationException(
            'Unauthenticated.',
            $guards,
            $redirect
        );
    }
}