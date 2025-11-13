<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // テーブルが無い or すでに user_id があるなら何もしない
        if (!Schema::hasTable('push_subscriptions') || Schema::hasColumn('push_subscriptions', 'user_id')) {
            return;
        }

        Schema::table('push_subscriptions', function (Blueprint $table) {
            // ここに来た時点で user_id は未作成
            $table->unsignedBigInteger('user_id')->nullable()->after('id');
            $table->index('user_id', 'push_subscriptions_user_id_index');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('push_subscriptions')) {
            return;
        }

        Schema::table('push_subscriptions', function (Blueprint $table) {
            // ある時だけ安全に削除
            if (Schema::hasColumn('push_subscriptions', 'user_id')) {
                // インデックス名が不明な場合の保険：存在していれば落とす（名前一致時のみ）
                try {
                    $table->dropIndex('push_subscriptions_user_id_index');
                } catch (\Throwable $e) {
                    // 無視（インデックスが無い/名前が違うケース）
                }
                $table->dropColumn('user_id');
            }
        });
    }
};