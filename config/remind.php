<?php

return [
    // 生成（remind:schedule-due）を有効化するか
    'enable_scheduler' => env('REMIND_ENABLE_SCHEDULER', false),

    // 送信（remind:send-due）を有効化するか
    'enable_sender'    => env('REMIND_ENABLE_SENDER', false),
];