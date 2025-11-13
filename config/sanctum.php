<?php

use Laravel\Sanctum\Sanctum;

return [

    /*
    |--------------------------------------------------------------------------
    | Stateful Domains
    |--------------------------------------------------------------------------
    | ここに書いたドメインから来たリクエストは
    | 「Cookieで認証するSPA（＝stateful）」として扱われる。
    |
    | .env に SANCTUM_STATEFUL_DOMAINS=... があればそれを使う。
    | なければローカル開発でよく使うものを一通り入れておく。
    */
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', (function () {
        // ローカルでだいたい使うやつ
        $defaults = [
            'localhost',
            'localhost:3000',
            'localhost:5173',
            'localhost:8000',
            '127.0.0.1',
            '127.0.0.1:8000',
            '::1',
        ];

        // app.url や現在のURLからも拾っておくとズレにくい
        $candidates = array_filter([
            config('app.url'),
            Sanctum::currentApplicationUrlWithPort(),
        ]);

        foreach ($candidates as $url) {
            $host = parse_url($url, PHP_URL_HOST);
            if (! $host) {
                continue;
            }
            $port = parse_url($url, PHP_URL_PORT);
            $defaults[] = $port ? "{$host}:{$port}" : $host;
        }

        // 重複排除してカンマ区切りに
        $unique = array_values(array_unique($defaults));

        return implode(',', $unique);
    })())),

    /*
    |--------------------------------------------------------------------------
    | Guards
    |--------------------------------------------------------------------------
    | Sanctum が「誰がログインしてるか」を解決するときに見るガード。
    | SPA + Cookie のときは基本 'web' でOK。
    */
    'guard' => ['web'],

    /*
    |--------------------------------------------------------------------------
    | Expiration
    |--------------------------------------------------------------------------
    | Personal Access Token の有効期限（分）。
    | CookieベースのSPAではここを null にしておくのが普通。
    */
    'expiration' => null,

    /*
    |--------------------------------------------------------------------------
    | Token Prefix
    |--------------------------------------------------------------------------
    | Personal Access Token を使うときの prefix。
    | 今回の Cookie 認証フローには関係しない。
    */
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    /*
    |--------------------------------------------------------------------------
    | Middleware
    |--------------------------------------------------------------------------
    | ここで指定したミドルウェアが Sanctum のルートで使われる。
    | encrypt_cookies / verify_csrf_token はだいたいこのままでOK。
    */
    'middleware' => [
        'encrypt_cookies'   => App\Http\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
