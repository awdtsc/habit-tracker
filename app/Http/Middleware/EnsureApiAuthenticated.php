<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class EnsureApiAuthenticated
{
    /**
     * 未ログインなら必ず 401 JSON を返す（/login へは絶対にリダイレクトしない）
     */
    public function handle(Request $request, Closure $next)
    {
        try {
            $user = Auth::guard('sanctum')->user()
                ?? Auth::guard('web')->user()
                ?? $request->user();

            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            // 下流で $request->user() が必ずこのユーザーを返すように固定
            $request->setUserResolver(fn () => $user);

            // Auth::user() のガードも固定（どちらか生きてる方）
            if (Auth::guard('sanctum')->check()) {
                Auth::shouldUse('sanctum');
            } elseif (Auth::guard('web')->check()) {
                Auth::shouldUse('web');
            }

            return $next($request);

        } catch (\Throwable $e) {
            Log::error('[auth.api] fatal', [
                'error' => $e->getMessage(),
                'file'  => $e->getFile(),
                'line'  => $e->getLine(),
            ]);

            return response()->json(['message' => 'Authentication middleware error'], 500);
        }
    }
}