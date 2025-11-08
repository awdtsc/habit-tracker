<?php
// database/migrations/2025_11_08_160000_consolidate_push_subscriptions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // 無ければ新規作成
        if (!Schema::hasTable('push_subscriptions')) {
            Schema::create('push_subscriptions', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->text('endpoint');
                $table->string('endpoint_hash', 64)->unique(); // SHA-256大文字
                $table->text('p256dh');
                $table->text('auth');
                $table->string('content_encoding', 32)->default('aes128gcm');
                $table->string('device', 64)->nullable();
                $table->text('user_agent')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamps();

                $table->index(['user_id']);
                $table->index(['last_used_at']);
            });
            return;
        }

        // 既存テーブルを正規化（不足列を追加）
        Schema::table('push_subscriptions', function (Blueprint $table) {
            if (!Schema::hasColumn('push_subscriptions', 'user_id'))         $table->foreignId('user_id')->nullable()->after('id');
            if (!Schema::hasColumn('push_subscriptions', 'endpoint'))         $table->text('endpoint')->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'endpoint_hash'))    $table->string('endpoint_hash', 64)->nullable()->after('endpoint');
            if (!Schema::hasColumn('push_subscriptions', 'p256dh'))           $table->text('p256dh')->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'auth'))             $table->text('auth')->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'content_encoding')) $table->string('content_encoding', 32)->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'device'))           $table->string('device', 64)->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'user_agent'))       $table->text('user_agent')->nullable();
            if (!Schema::hasColumn('push_subscriptions', 'last_used_at'))     $table->timestamp('last_used_at')->nullable();
            if (!Schema::hasColumns('push_subscriptions', ['created_at','updated_at'])) $table->timestamps();
        });

        // endpoint の重複除去（ID小さい方を残す）
        try {
            DB::statement("
                DELETE t1 FROM push_subscriptions t1
                JOIN push_subscriptions t2
                  ON t1.endpoint = t2.endpoint
                 AND t1.id > t2.id
            ");
        } catch (\Throwable $e) {}

        // endpoint_hash を埋める
        try {
            DB::statement("
                UPDATE push_subscriptions
                   SET endpoint_hash = UPPER(SHA2(endpoint, 256))
                 WHERE endpoint IS NOT NULL
                   AND (endpoint_hash IS NULL OR endpoint_hash = '')
            ");
        } catch (\Throwable $e) {}

        // content_encoding のデフォルト埋め
        try {
            DB::statement("
                UPDATE push_subscriptions
                   SET content_encoding = COALESCE(content_encoding, 'aes128gcm')
                 WHERE content_encoding IS NULL OR content_encoding = ''
            ");
        } catch (\Throwable $e) {}

        // 制約・インデックス
        try {
            DB::statement("
                ALTER TABLE push_subscriptions
                ADD CONSTRAINT push_subscriptions_user_id_foreign
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ");
        } catch (\Throwable $e) {}

        try { DB::statement("
            ALTER TABLE push_subscriptions
            MODIFY COLUMN endpoint_hash CHAR(64) NOT NULL
        "); } catch (\Throwable $e) {}

        try { DB::statement("
            CREATE UNIQUE INDEX push_subscriptions_endpoint_hash_unique
              ON push_subscriptions(endpoint_hash)
        "); } catch (\Throwable $e) {}

        try { DB::statement("CREATE INDEX push_subscriptions_user_id_index     ON push_subscriptions(user_id)"); } catch (\Throwable $e) {}
        try { DB::statement("CREATE INDEX push_subscriptions_last_used_at_index ON push_subscriptions(last_used_at)"); } catch (\Throwable $e) {}

        // 旧モーフ列があれば撤去
        if (Schema::hasColumn('push_subscriptions', 'subscribable_type') &&
            Schema::hasColumn('push_subscriptions', 'subscribable_id')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->dropColumn(['subscribable_type', 'subscribable_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};