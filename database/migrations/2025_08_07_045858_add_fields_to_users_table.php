<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user');         // user, staff, admin
            $table->string('mode')->default('normal');       // normal, assist, minimal
            $table->integer('daily_limit')->nullable();      // 表示制限
            $table->string('timezone')->default('Asia/Tokyo'); // 現在時刻で切り替えのため
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'mode', 'daily_limit', 'timezone']);
        });
    }
};