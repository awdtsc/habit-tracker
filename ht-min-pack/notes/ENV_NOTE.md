# ENV NOTE（実値は入れないでください）

APP_ENV=local
APP_KEY=（key:generate 後に自動埋め）
APP_URL=http://localhost:8000
SESSION_DOMAIN=localhost

SANCTUM_STATEFUL_DOMAINS=localhost,localhost:8000,127.0.0.1,127.0.0.1:8000,::1

# DB (例)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=habit_tracker
DB_USERNAME=root
DB_PASSWORD=

# CORS 注意
# config/cors.php で http://localhost:5173 を許可
