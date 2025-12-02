<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private function indexNames(string $table): array {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select("PRAGMA index_list('{$table}')"))
                ->pluck('name')
                ->map(fn ($n) => strtolower((string) $n))
                ->all();
        }

        if ($driver === 'mysql') {
            return collect(DB::select("SHOW INDEX FROM {$table}"))
                ->pluck('Key_name')
                ->map(fn ($n) => strtolower((string) $n))
                ->all();
        }

        // Fallback（情報スキーマ）
        try {
            return collect(
                DB::table('information_schema.statistics')
                    ->where('table_schema', DB::getDatabaseName())
                    ->where('table_name', $table)
                    ->pluck('index_name')
            )
                ->map(fn ($n) => strtolower((string) $n))
                ->all();
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function up(): void
    {
        $table = 'habit_logs';
        if (!Schema::hasTable($table)) return;

        // 1) habit_id 単独インデックス（FK 要件/検索最適化用）
        $existing = $this->indexNames($table);
        if (
            !in_array('idx_habit_logs_habit_id', $existing, true) &&
            !in_array('habit_logs_habit_id_index', $existing, true)
        ) {
            Schema::table($table, function (Blueprint $t) {
                $t->index('habit_id', 'idx_habit_logs_habit_id');
            });
        }

        // 2) 旧ユニークを安全に drop
        // ⚠ 外部キーで参照されている可能性のある 'uq_user_habit_date_slot' は **触らない**
        $existing = $this->indexNames($table);
        $toDrop = [
            'habit_logs_habit_id_date_unique',    // 旧 (habit_id, date)
            // 'uq_user_habit_date_slot',          // ← 外部キー参照のため残す
            'habit_logs_habit_date_slot_unique',  // 過去の誤名残があれば落とす
        ];
        foreach ($toDrop as $idx) {
            if (in_array(strtolower($idx), $existing, true)) {
                Schema::table($table, function (Blueprint $t) use ($idx) {
                    try { $t->dropUnique($idx); } catch (\Throwable $e) {}
                });
                // ここで $table を使う（$t はこのスコープにいない）
                try { DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$idx}`"); } catch (\Throwable $e) {}
            }
        }

        // 3) time_slot が無ければ追加
        if (!Schema::hasColumn($table, 'time_slot')) {
            Schema::table($table, function (Blueprint $t) {
                $t->tinyInteger('time_slot')->unsigned()->default(0)->after('date');
            });
        }

        // 4) 新ユニーク (habit_id, date, time_slot)
        $existing = $this->indexNames($table);
        $newIndex = 'habit_logs_habit_date_slot_unique';
        if (!in_array(strtolower($newIndex), $existing, true)) {
            Schema::table($table, function (Blueprint $t) use ($newIndex) {
                $t->unique(['habit_id', 'date', 'time_slot'], $newIndex);
            });
        }
    }

    public function down(): void
    {
        $table = 'habit_logs';
        if (!Schema::hasTable($table)) return;

        // 新ユニークを drop
        $existing = $this->indexNames($table);
        $newIndex = 'habit_logs_habit_date_slot_unique';
        if (in_array(strtolower($newIndex), $existing, true)) {
            Schema::table($table, function (Blueprint $t) use ($newIndex) {
                try { $t->dropUnique($newIndex); } catch (\Throwable $e) {}
            });
        }

        // 旧ユニーク (habit_id, date) を復元
        $existing = $this->indexNames($table);
        $legacy = 'habit_logs_habit_id_date_unique';
        if (!in_array(strtolower($legacy), $existing, true)) {
            Schema::table($table, function (Blueprint $t) use ($legacy) {
                $t->unique(['habit_id','date'], $legacy);
            });
        }

        // idx_habit_logs_habit_id は残してOK
        // 戻したい場合のみ dropIndex を追加
    }
};