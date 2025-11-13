<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB; // ★ これが無いと Intelephense が P1009 を出す

return new class extends Migration {
    public function up(): void
    {
        Schema::table('push_subscriptions', function (Blueprint $table) {
            // 位置指定(after)は使わず追加（存在しなければ）
            if (!Schema::hasColumn('push_subscriptions', 'user_agent')) {
                $table->string('user_agent')->nullable();
            }
            if (!Schema::hasColumn('push_subscriptions', 'device_hint')) {
                $table->string('device_hint')->nullable();
            }
            if (!Schema::hasColumn('push_subscriptions', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable();
            }
            if (!Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
                $table->char('endpoint_hash', 64)->nullable();
            }
        });

        // 既存 endpoint から endpoint_hash を埋める
        DB::statement("
            UPDATE push_subscriptions
            SET endpoint_hash = SHA2(endpoint, 256)
            WHERE endpoint IS NOT NULL AND (endpoint_hash IS NULL OR endpoint_hash = '')
        ");

        // 既存のユニークキーがあれば落とす（存在しなければ無視）
        try {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->dropUnique('push_subscriptions_endpoint_hash_unique');
                $table->dropUnique('ps_owner_hash_unique');
                $table->dropUnique('ps_user_hash_unique');
            });
        } catch (\Throwable $e) { /* noop */ }

        // morph 構成か user_id 構成かでユニークキーを貼り分け
        if (Schema::hasColumn('push_subscriptions', 'subscribable_type') &&
            Schema::hasColumn('push_subscriptions', 'subscribable_id')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->unique(['subscribable_type', 'subscribable_id', 'endpoint_hash'], 'ps_owner_hash_unique');
            });
        } elseif (Schema::hasColumn('push_subscriptions', 'user_id')) {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->unique(['user_id', 'endpoint_hash'], 'ps_user_hash_unique');
            });
        }
    }

    public function down(): void
    {
        // ユニーク解除（存在しなければ無視）
        try {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->dropUnique('ps_owner_hash_unique');
            });
        } catch (\Throwable $e) {}
        try {
            Schema::table('push_subscriptions', function (Blueprint $table) {
                $table->dropUnique('ps_user_hash_unique');
            });
        } catch (\Throwable $e) {}

        // 追加カラムの削除（必要なら）
        Schema::table('push_subscriptions', function (Blueprint $table) {
            if (Schema::hasColumn('push_subscriptions', 'last_seen_at')) {
                $table->dropColumn('last_seen_at');
            }
            if (Schema::hasColumn('push_subscriptions', 'device_hint')) {
                $table->dropColumn('device_hint');
            }
            if (Schema::hasColumn('push_subscriptions', 'user_agent')) {
                $table->dropColumn('user_agent');
            }
            if (Schema::hasColumn('push_subscriptions', 'endpoint_hash')) {
                $table->dropColumn('endpoint_hash');
            }
        });
    }
};