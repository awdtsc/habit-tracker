<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;

Route::middleware('web')->group(function () {

    /**
     * JSON Login (POST)
     */
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

    /**
     * JSON Logout (POST)
     */
    Route::post('/logout', function (Request $request) {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->noContent();
    });

    /**
     * GET /login → SPA shell
     */
    Route::get('/login', function () {
        return view('app');
    })->name('login');

    /**
     * SPA Catch-all
     */
    Route::view('/{any}', 'app')
        ->where('any', '^(?!api|sanctum).*$');
});