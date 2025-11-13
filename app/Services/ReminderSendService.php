<?php

namespace App\Services;

use Carbon\CarbonInterface;

class ReminderSendService
{
    /**
     * Send due reminders for the given moment. Placeholder for Phase 2/3 wiring.
     *
     * @return array{run_at:string,sent:int,skipped:int,errors:int}
     */
    public function sendDue(?CarbonInterface $now = null): array
    {
        $timezone = config('app.timezone', 'Asia/Tokyo');
        $nowJst = $now?->copy()->setTimezone($timezone) ?? now($timezone);

        // Phase 2 will introduce RemindTask table integration.
        return [
            'run_at' => $nowJst->toDateTimeString(),
            'sent' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];
    }
}