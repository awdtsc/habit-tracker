<?php

return [

    // ✅ 認証で使うエンドポイントを含める
    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'login',
        'logout',
    ],

    'allowed_methods' => ['*'],

    // ✅ 開発で使う全オリジンを許可（Vite 5173 / PHP 8000）
    'allowed_origins' => [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // ✅ Cookie を送受信できるように
    'supports_credentials' => true,
];
