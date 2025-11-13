<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * InitDailyHabitLogs
 *
 * 【重要】このコマンドは設計変更により「実質ノーオペ(生成しない)」へ移行しました。
 *  - HabitLog / RemindTask の自動生成は **AutoLogAndRemindService** に一本化。
 *  - 予定時刻到来時の生成は `php artisan remind:schedule-due` に任せてください。
 *
 * 本コマンドは、既存の運用・バッチからの呼び出し互換を維持するために残してありますが、
 * 実処理は行わず、警告メッセージを出すのみです。
 *
 * 使い方（これまで互換の引数は残していますが、現在は無視されます）:
 *   php artisan habits:init-daily --date=YYYY-MM-DD --now="YYYY-MM-DD HH:MM:SS"
 */
class InitDailyHabitLogs extends Command
{
    /** @var string */
    protected $signature = 'habits:init-daily 
        {--date= : (互換) 対象日。現在は使用されません} 
        {--now= : (互換) 実行時刻。現在は使用されません}';

    /** @var string */
    protected $description = '[DEPRECATED] Daily init has been retired. Use remind:schedule-due for on-time creation.';

    public function handle(): int
    {
        $dateOpt = (string)($this->option('date') ?? '');
        $nowOpt  = (string)($this->option('now')  ?? '');

        $msg = "[habits:init-daily] DEPRECATED: No-op. "
             . "Auto creation of HabitLog/RemindTask is unified to AutoLogAndRemindService via `remind:schedule-due`."
             . ($dateOpt ? " (date={$dateOpt})" : "")
             . ($nowOpt  ? " (now={$nowOpt})"   : "");

        $this->warn($msg);
        Log::info($msg);

        // 互換維持のため常に成功終了
        return self::SUCCESS;
    }
}