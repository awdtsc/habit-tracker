<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // status を文字列に変更
        Schema::table('habit_logs', function (Blueprint $table) {
            $table->string('status', 20)->default('none')->change();
        });

        // 既存の 0/1 を文字列に変換
        DB::table('habit_logs')->where('status', '0')->update(['status' => 'none']);
        DB::table('habit_logs')->where('status', '1')->update(['status' => 'done']);
    }

    public function down(): void
    {
        // 逆変換
        DB::table('habit_logs')->where('status', 'none')->update(['status' => '0']);
        DB::table('habit_logs')->where('status', 'done')->update(['status' => '1']);

        Schema::table('habit_logs', function (Blueprint $table) {
            $table->tinyInteger('status')->default(0)->change();
        });
    }
};
