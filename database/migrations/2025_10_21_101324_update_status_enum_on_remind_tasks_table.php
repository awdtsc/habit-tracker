<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add 'canceled' to remind_tasks.status enum
     */
    public function up(): void
    {
        return; // ← 無力化（何もしない）
    }

    public function down(): void
    {
        return; // ← 無力化（何もしない）
    }
};