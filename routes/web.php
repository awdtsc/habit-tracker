<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| Web Routes (SPA)
|--------------------------------------------------------------------------
| - login/logout は JSON API として動かす
| - GET /login およびすべての画面遷移は SPA Shell を返す
|--------------------------------------------------------------------------
*/

Route::middleware('web')->group(function () {

    // ---- JSON Login (POST) ----
    Route::post('/login', function (Request $request) {

        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::attempt($credentials)) {
            $request->session()->regenerate();
            return response()->json([
                'ok'   => true,
                'user' => Auth::user(),
            ]);
        }

        return response()->json([
            'message' => 'Invalid credentials',
        ], 422);
    });

    // ---- JSON Logout (POST) ----
    Route::post('/logout', function (Request $request) {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->noContent();
    });

    // ---- SPA Shell for ALL GET routes except /api ----
    Route::get('/{any}', function () {
        return view('app');     // Vue SPA
    })->where('any', '^(?!api|sanctum).*$');

});