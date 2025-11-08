<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // (重複があれば古い方を削除)
        DB::statement("
            DELETE t1 FROM remind_tasks t1
            JOIN remind_tasks t2
              ON t1.habit_log_id = t2.habit_log_id
             AND t1.remind_at    = t2.remind_at
             AND t1.id < t2.id
        ");

        Schema::table('remind_tasks', function (Blueprint $table) {
            $table->unique(['habit_log_id', 'remind_at'], 'uq_remind_log_at');
        });
    }

    public function down(): void
    {
        Schema::table('remind_tasks', function (Blueprint $table) {
            $table->dropUnique('uq_remind_log_at');
        });
    }
};
