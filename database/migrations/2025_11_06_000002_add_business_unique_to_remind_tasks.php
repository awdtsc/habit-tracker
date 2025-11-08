<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            $db = DB::getDatabaseName();
            return DB::table('information_schema.statistics')
                ->where('table_schema', $db)
                ->where('table_name', $table)
                ->where('index_name', $indexName)
                ->exists();
        }

        if ($driver === 'sqlite') {
            $rows = DB::select("PRAGMA index_list('{$table}')");
            foreach ($rows as $row) {
                if (isset($row->name) && $row->name === $indexName) return true;
            }
            return false;
        }

        if ($driver === 'pgsql') {
            return DB::table('pg_indexes')
                ->where('schemaname', 'public')
                ->where('tablename', $table)
                ->where('indexname', $indexName)
                ->exists();
        }

        return false;
    }

    public function up(): void {
        $table = 'remind_tasks';
        if (!Schema::hasTable($table)) return;

        // Business unique to prevent duplicate schedule creations per log per scheduled time
        $index = 'remind_tasks_business_unique';
        if (!$this->hasIndex($table, $index)) {
            Schema::table($table, function (Blueprint $t) use ($index) {
                $t->unique(['habit_log_id','remind_at'], $index);
            });
        }
    }

    public function down(): void {
        $table = 'remind_tasks';
        if (!Schema::hasTable($table)) return;

        $index = 'remind_tasks_business_unique';
        if ($this->hasIndex($table, $index)) {
            Schema::table($table, function (Blueprint $t) use ($index) {
                $t->dropUnique($index);
            });
        }
    }
};

