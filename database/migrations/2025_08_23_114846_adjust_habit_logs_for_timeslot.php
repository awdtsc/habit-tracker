<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {

    /** 既存インデックス名の一覧（小文字）を返す */
    private function indexNames(string $table): array
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            // SQLite: PRAGMA で取得（name）
            return collect(DB::select("PRAGMA index_list('{$table}')"))
                ->pluck('name')
                ->map(fn ($n) => strtolower((string)$n))
                ->all();
        }

        // MySQL 等: SHOW INDEX（Key_name）
        return collect(DB::select("SHOW INDEX FROM {$table}"))
            ->pluck('Key_name')
            ->map(fn ($n) => strtolower((string)$n))
            ->all();
    }

    /** インデックスを if exists で安全に削除（DB 別） */
    private function dropIndexIfExists(string $table, string $index): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'sqlite') {
            // SQLite は DROP INDEX IF EXISTS が使える（テーブル名は不要）
            DB::statement("DROP INDEX IF EXISTS {$index}");
            return;
        }

        // MySQL 等
        DB::statement("ALTER TABLE {$table} DROP INDEX {$index}");
    }

    public function up(): void
    {
        // 1) 必要カラムを追加（存在しなければ）
        Schema::table('habit_logs', function (Blueprint $table) {
            // ※ アプリ側は 'time_slot' を参照しているため 'time_slot' 名で統一
            if (!Schema::hasColumn('habit_logs', 'time_slot')) {
                $table->tinyInteger('time_slot')->unsigned()->default(0)->after('date');
            }
            if (!Schema::hasColumn('habit_logs', 'rating')) {
                $table->tinyInteger('rating')->unsigned()->nullable()->after('status');
            }
            if (!Schema::hasColumn('habit_logs', 'checked_at')) {
                $table->dateTime('checked_at')->nullable()->after('status');
            }
        });

        // 2) 旧ユニークキーがあれば落とす
        $existing = $this->indexNames('habit_logs');

        // 想定される旧インデックス名の候補（小文字で比較）
        $oldIndexes = [
            'uq_user_habit_date',
            'habit_logs_user_id_habit_id_date_unique',
        ];

        foreach ($oldIndexes as $old) {
            if (in_array(strtolower($old), $existing, true)) {
                $this->dropIndexIfExists('habit_logs', $old);
            }
        }

        // 3) 新ユニークキー（user_id, habit_id, date, time_slot）を無いときだけ追加
        $existing = $this->indexNames('habit_logs');
        $newIndex = 'uq_user_habit_date_slot';

        if (!in_array(strtolower($newIndex), $existing, true)) {
            Schema::table('habit_logs', function (Blueprint $table) use ($newIndex) {
                $table->unique(['user_id','habit_id','date','time_slot'], $newIndex);
            });
        }
    }

    public function down(): void
    {
        // 新ユニークキーを外す（あれば）
        $existing = $this->indexNames('habit_logs');
        $newIndex = 'uq_user_habit_date_slot';

        if (in_array(strtolower($newIndex), $existing, true)) {
            // Schema::table の dropUnique は DB によっては名前が必要
            Schema::table('habit_logs', function (Blueprint $table) use ($newIndex) {
                $table->dropUnique($newIndex);
            });

            // SQLite の場合、念のため直で DROP も試みる（存在すれば）
            if (DB::getDriverName() === 'sqlite') {
                DB::statement("DROP INDEX IF EXISTS {$newIndex}");
            }
        }

        // 追加カラムを元に戻す（存在チェックしつつ）
        Schema::table('habit_logs', function (Blueprint $table) {
            if (Schema::hasColumn('habit_logs', 'time_slot')) { $table->dropColumn('time_slot'); }
            if (Schema::hasColumn('habit_logs', 'rating'))     { $table->dropColumn('rating'); }
            if (Schema::hasColumn('habit_logs', 'checked_at')) { $table->dropColumn('checked_at'); }
        });
    }
};