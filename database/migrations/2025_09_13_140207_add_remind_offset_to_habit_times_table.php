<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            $table->integer('remind_offset')
                  ->default(0)           // デフォルトは「再通知なし」
                  ->after('notify_time'); // notify_time の後ろに追加
        });
    }

    public function down(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            $table->dropColumn('remind_offset');
        });
    }
};