<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('habit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('habit_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->date('date'); // 記録日
            $table->boolean('status')->nullable(); // ○→1, ×→0, 未記録→null
            $table->text('note')->nullable(); // 任意メモ
            $table->timestamps();

            $table->unique(['habit_id', 'date']); // 1習慣1日につき1レコード制約
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('habit_logs');
    }
};
