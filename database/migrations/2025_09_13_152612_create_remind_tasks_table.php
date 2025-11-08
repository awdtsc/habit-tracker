<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('remind_tasks', function (Blueprint $table) {
            $table->id();

            // HabitLog に外部キーで紐づけ（削除連鎖）
            $table->foreignId('habit_log_id')
                ->constrained('habit_logs')
                ->cascadeOnDelete();

            // 通知予定時刻
            $table->timestamp('remind_at');

            // スヌーズ/再通知などの設定（将来拡張を見据えて JSON に）
            // 例: {"type":"preset","value":"5m"} / {"type":"custom","minutes":12}
            $table->json('reschedule')->nullable();

            // 状態（enumは使わずstringで統一）
            // 候補: pending / sent / cancelled / skipped / error
            $table->string('status', 20)->default('pending');

            $table->timestamps();

            // 運用向けの索引（重複作成を避けるためCREATEに集約）
            $table->index(['status', 'remind_at']);
            $table->index('habit_log_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('remind_tasks');
    }
};