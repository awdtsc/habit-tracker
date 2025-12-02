<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('push_subscriptions', function (Blueprint $table) {
            // まず外部キー制約を削除
            $table->dropForeign(['user_id']);

            // 次にカラムを削除
            $table->dropColumn('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('push_subscriptions', function (Blueprint $table) {
            // down では復元（必要なら）
            $table->foreignId('user_id')->nullable()->after('id');
        });
    }
};
