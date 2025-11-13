<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            $table->time('notify_time')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            $table->time('notify_time')->nullable(false)->change();
        });
    }
};
