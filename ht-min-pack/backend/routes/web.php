<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\ProfileController;

/*
|--------------------------------------------------------------------------
| Web Routes (SPA 優先構成・Sanctum用)
|--------------------------------------------------------------------------
| ポイント：
| 1) すべて web ミドルウェア内で処理（セッション/Cookieを有効に）
| 2) POST /login でセッションを開く（SPA向けにJSON返却）
| 3) GET /login / ダッシュボード等は SPA の app.blade.php を返す
| 4) 未認証時のリダイレクトで参照される「名前付きルート login」を必ず定義
*/

Route::middleware('web')->group(function () {

    /* ====== 1. デバッグ用 ====== */
    Route::get('/debug-test', fn () => 'debug ok');

    Route::get('/test-log', function () {
        Log::info('テストログ from route');
        return 'ok';
    });

    /* ====== 2. ログイン / ログアウト（JSONベース） ====== */
    Route::post('/login', function (Request $request) {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::attempt($credentials)) {
            // セッション再発行（セッション固定攻撃対策）
            $request->session()->regenerate();

            Log::info('[web-login] success', [
                'id'    => Auth::id(),
                'email' => $request->email,
                'ip'    => $request->ip(),
            ]);

            return response()->json([
                'ok'   => true,
                'user' => Auth::user(),
            ], 200);
        }

        Log::info('[web-login] failed', [
            'email' => $request->email,
            'ip'    => $request->ip(),
        ]);

        return response()->json(['message' => 'Invalid credentials'], 422);
    })->name('web.login');

    Route::post('/logout', function (Request $request) {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->noContent(); // 204
    })->name('web.logout');

    /* ====== 3. 認証が必要な従来ページ（必要なら） ====== */
    Route::middleware('auth')->group(function () {
        Route::get('/profile',   [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile',[ProfileController::class, 'destroy'])->name('profile.destroy');
    });

    /* ====== 4. SPAシェルを返すルート ====== */

    // ★ 未認証時のリダイレクトで参照される「名前付きルート login」を必ず定義
    Route::view('/login', 'app')->name('login');

    // ダッシュボード
    Route::view('/dashboard', 'app')->name('dashboard');
    Route::view('/dashboard/{any}', 'app')->where('any', '.*');

    // 習慣系
    Route::view('/habits', 'app')->name('habits.index');
    Route::view('/habits/create', 'app')->name('habits.create');
    Route::view('/habits/{any}', 'app')->where('any', '.*');

    // トップもSPA
    Route::view('/', 'app')->name('root');

    // Catch-all（/api と /sanctum は除外）
    Route::view('/{any}', 'app')
        ->where('any', '^(?!api|sanctum).*$');
});