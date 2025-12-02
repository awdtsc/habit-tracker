<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            // 0=いつでも, 1=朝, 2=昼, 3=夕, 4=夜
            if (!Schema::hasColumn('habit_times', 'time_slot')) {
                $table->unsignedTinyInteger('time_slot')
                      ->default(0)
                      ->after('habit_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('habit_times', function (Blueprint $table) {
            if (Schema::hasColumn('habit_times', 'time_slot')) {
                $table->dropColumn('time_slot');
            }
        });
    }
};
