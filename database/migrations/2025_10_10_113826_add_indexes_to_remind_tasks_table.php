<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = 'remind_tasks';
        if (!Schema::hasTable($table)) {
            return; // まだテーブルがないなら何もしない
        }

        // 追加したいインデックス名（Laravelのデフォ名に合わせる）
        $statusRemindAtIdx = 'remind_tasks_status_remind_at_index';
        $habitLogIdIdx     = 'remind_tasks_habit_log_id_index';

        // すでに存在するかをドライバ別に判定
        if (!$this->hasIndex($table, $statusRemindAtIdx)) {
            Schema::table($table, function (Blueprint $t) {
                $t->index(['status', 'remind_at']);
            });
        }

        if (!$this->hasIndex($table, $habitLogIdIdx)) {
            Schema::table($table, function (Blueprint $t) {
                $t->index('habit_log_id');
            });
        }
    }

    public function down(): void
    {
        $table = 'remind_tasks';
        if (!Schema::hasTable($table)) {
            return;
        }

        $statusRemindAtIdx = 'remind_tasks_status_remind_at_index';
        $habitLogIdIdx     = 'remind_tasks_habit_log_id_index';

        // 存在する場合のみ dropIndex
        if ($this->hasIndex($table, $statusRemindAtIdx)) {
            Schema::table($table, function (Blueprint $t) use ($statusRemindAtIdx) {
                $t->dropIndex($statusRemindAtIdx);
            });
        }

        if ($this->hasIndex($table, $habitLogIdIdx)) {
            Schema::table($table, function (Blueprint $t) use ($habitLogIdIdx) {
                $t->dropIndex($habitLogIdIdx);
            });
        }
    }

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
            // PRAGMA でインデックス一覧を取得
            $rows = DB::select("PRAGMA index_list('{$table}')");
            foreach ($rows as $row) {
                // $row->name にインデックス名
                if (isset($row->name) && $row->name === $indexName) {
                    return true;
                }
            }
            return false;
        }

        if ($driver === 'pgsql') {
            // pg_indexes で確認
            return DB::table('pg_indexes')
                ->where('schemaname', 'public')
                ->where('tablename', $table)
                ->where('indexname', $indexName)
                ->exists();
        }

        // 未対応ドライバは慎重に false 扱い（→作成を試みる）
        return false;
    }
};