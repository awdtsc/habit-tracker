<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    /**
     * アプリ全体で走るグローバルミドルウェア
     */
    protected $middleware = [
        // 逆プロキシ（URL/HTTPSの信頼）
        \App\Http\Middleware\TrustProxies::class,

        // CORS（Laravel推奨の順序：なるべく早い段に置く）
        \Illuminate\Http\Middleware\HandleCors::class,

        // メンテナンス・基本設定
        \Illuminate\Foundation\Http\Middleware\PreventRequestsDuringMaintenance::class,
        \Illuminate\Foundation\Http\Middleware\ValidatePostSize::class,
        \Illuminate\Foundation\Http\Middleware\TrimStrings::class,
        \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
    ];

    /**
     * ミドルウェアグループ
     *
     * ※ Laravel 12 ではミドルウェアの alias/グループ編集は
     *    基本的に bootstrap/app.php の ->withMiddleware(...) で行います。
     *    ここは従来互換（表示の都合など）として残しています。
     */
    protected $middlewareGroups = [
        // --------------------------------------------------
        // web: ブラウザ(Blade/SPA)用。セッションあり。
        // --------------------------------------------------
        'web' => [
            // クッキー暗号化・復号
            \App\Http\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,

            // セッション開始（Cookie認証必須）
            \Illuminate\Session\Middleware\StartSession::class,

            // （Sanctumのセッション連動は bootstrap/app.php で append 済み）
            // \Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,

            // バリデーションエラー等をビューへ
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,

            // CSRF（webのみ）
            \App\Http\Middleware\VerifyCsrfToken::class,

            // ルートモデルバインディング等
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],

        // --------------------------------------------------
        // api: /api/* 用。基本は stateless。
        // SPAからのCookie付きは stateful として受ける。
        // --------------------------------------------------
        'api' => [
            // SPA同一オリジンのCookie付き要求を stateful として扱う（Sanctum）
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,

            // （任意）/api/* を常に JSON として扱いたい場合は有効化
            // \App\Http\Middleware\ForceJsonForApi::class,

            // レートリミット
            'throttle:api',

            // ルートモデルバインディング
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ],
    ];

    /**
     * ルートミドルウェア（Laravel 9 互換）
     * ※ Laravel 12 では alias は bootstrap/app.php で管理します。
     *   ここには auth.api を定義しない（重複防止）。
     */
    protected $routeMiddleware = [
        'auth'             => \App\Http\Middleware\Authenticate::class, // ← 自作Authenticateを必ず指す
        'auth.basic'       => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
        'cache.headers'    => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        'can'              => \Illuminate\Auth\Middleware\Authorize::class,
        'guest'            => \Illuminate\Auth\Middleware\RedirectIfAuthenticated::class,
        'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
        'signed'           => \Illuminate\Routing\Middleware\ValidateSignature::class,
        'throttle'         => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'verified'         => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,

        // ★ API専用ミドルウェアの alias は bootstrap/app.php で登録する
        // 'auth.api' => \App\Http\Middleware\EnsureApiAuthenticated::class,
    ];

    /**
     * ルートミドルウェア（Laravel 10/11 形式の互換エイリアス）
     * ※ Laravel 12 では使用されません。保守目的で残す場合も auth.api は置かない。
     */
    protected $middlewareAliases = [
        'auth'             => \App\Http\Middleware\Authenticate::class, // ← 自作Authenticateを必ず指す
        'auth.basic'       => \Illuminate\Auth\Middleware\AuthenticateWithBasicAuth::class,
        'cache.headers'    => \Illuminate\Http\Middleware\SetCacheHeaders::class,
        'can'              => \Illuminate\Auth\Middleware\Authorize::class,
        'guest'            => \Illuminate\Auth\Middleware\RedirectIfAuthenticated::class,
        'password.confirm' => \Illuminate\Auth\Middleware\RequirePassword::class,
        'signed'           => \Illuminate\Routing\Middleware\ValidateSignature::class,
        'throttle'         => \Illuminate\Routing\Middleware\ThrottleRequests::class,
        'verified'         => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,

        // 'auth.api' は bootstrap/app.php で alias 済み
    ];
}