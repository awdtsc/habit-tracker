<?php
// database/migrations/xxxx_xx_xx_create_habit_times_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('habit_times', function (Blueprint $table) {
            $table->id();
            $table->foreignId('habit_id')->constrained()->onDelete('cascade');
            $table->time('notify_time'); // 分単位で通知時刻を保存
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('habit_times');
    }
};