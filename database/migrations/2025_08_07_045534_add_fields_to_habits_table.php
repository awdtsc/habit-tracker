<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('habits', function (Blueprint $table) {
            $table->string('time_slot')->default('anytime'); // 朝・昼・夜・いつでも
            $table->string('category')->nullable();
            $table->string('color_tag')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('habits', function (Blueprint $table) {
            $table->dropColumn(['time_slot', 'category', 'color_tag']);
        });
    }
};
