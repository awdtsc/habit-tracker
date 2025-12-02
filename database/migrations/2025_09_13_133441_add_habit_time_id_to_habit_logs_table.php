<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('habit_logs', function (Blueprint $table) {
            // habit_time_id を追加（habit_times テーブルと関連付け）
            if (!Schema::hasColumn('habit_logs', 'habit_time_id')) {
                $table->foreignId('habit_time_id')
                      ->nullable()
                      ->constrained('habit_times')
                      ->onDelete('cascade')
                      ->after('habit_id');
            }

            // status カラムを enum に変更（必要なら）
            // ※既存が varchar などなら change() を使う
            // $table->enum('status', ['none', 'done', 'skipped'])
            //       ->default('none')
            //       ->change();
        });
    }

    public function down(): void
    {
        Schema::table('habit_logs', function (Blueprint $table) {
            if (Schema::hasColumn('habit_logs', 'habit_time_id')) {
                $table->dropForeign(['habit_time_id']);
                $table->dropColumn('habit_time_id');
            }
        });
    }
};
