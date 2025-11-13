<?php

namespace App\Policies;

use App\Models\RemindTask;
use App\Models\User;

class RemindTaskPolicy
{
    /**
     * タスクの所有者かどうか
     */
    private function isOwner(User $user, RemindTask $task): bool
    {
        // RemindTask の owner_user_id アクセサ（getOwnerUserIdAttribute）を想定
        return $user->id === ($task->owner_user_id ?? $task->ownerUserId ?? null);
    }

    public function view(User $user, RemindTask $task): bool
    {
        return $this->isOwner($user, $task);
    }

    public function snooze(User $user, RemindTask $task): bool
    {
        return $this->isOwner($user, $task);
    }

    public function done(User $user, RemindTask $task): bool
    {
        return $this->isOwner($user, $task);
    }

    public function cancel(User $user, RemindTask $task): bool
    {
        return $this->isOwner($user, $task);
    }
}