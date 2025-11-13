<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * If the user is already authenticated, redirect them away from guest-only pages
     * such as /login or /register.
     */
    public function handle(Request $request, Closure $next, string|null ...$guards): Response
    {
        $guards = $guards ?: [null];

        foreach ($guards as $guard) {
            if (Auth::guard($guard)->check()) {
                // 好みで変更可：ログイン済みならダッシュボードへ
                return redirect()->route('dashboard');
            }
        }

        return $next($request);
    }
}