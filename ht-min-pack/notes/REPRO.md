# REPRO（最小再現手順）

## 1. 前提
- OS: Windows 11 Pro (10.0.26100)
- XAMPP Control Panel: 3.3.0
- Apache: 2.4.58 (Win64) OpenSSL 3.1.3
- PHP: 8.2.12
- Laravel: 12.21.0
- Node: 22.18.0 / npm: 10.9.3
- DB: MariaDB 10.4.32

## 2. 起動
1) `composer install`
2) `.env` は ENV_NOTE.md の例を参考に新規作成 → `php artisan key:generate`
3) `mysql -u root -p < db/schema.sql`
4) `php artisan migrate`（必要なら）
5) バックエンド: `php artisan serve --port=8000`
6) フロント: `npm run dev`（Vite 5173）

## 3. アクセス
- http://localhost:8000/dashboard/today

## 4. 期待と実際（例：P0）
- 期待: ログイン済なら `/api/user` が 200
- 実際: 401（Unauthenticated）→ Networkに `XSRF-TOKEN` と `laravel_session` は存在
- Console: Uncaught (in promise) 401 at axios...
- Laravelログ: storage/logs/laravel.log に Unauthenticated warn
