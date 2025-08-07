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
        Schema::create('habits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('frequency_type'); // 'daily', 'weekly', 'custom' など
            $table->json('days_of_week')->nullable(); // ["mon", "wed"] のような形式
            $table->json('target_times')->nullable(); // ["morning", "evening"]など
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('archived')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('habits');
    }
};
