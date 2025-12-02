<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Support\Facades\Log;
use Throwable;

class Handler extends ExceptionHandler
{
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {});
    }

    protected function unauthenticated($request, AuthenticationException $e)
    {
        $isApi = $request->is('api/*') || $request->expectsJson();
        Log::info('[HANDLER.unauthenticated]', [
            'path' => $request->path(),
            'is_api' => $isApi,
            'accept' => $request->header('Accept'),
        ]);

        if ($isApi) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }
        return redirect()->guest('/login');
    }
}