<?php

namespace App\Services;

use App\Models\Habit;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class SchedulingService
{
    /**
     * Normalize a date to JST midnight based on the application timezone.
     */
    public function normalizeDate(CarbonInterface $date): CarbonInterface
    {
        $timezone = config('app.timezone', 'Asia/Tokyo');

        return $date->copy()->setTimezone($timezone)->startOfDay();
    }

    /**
     * Return the habits scheduled for the provided date.
     */
    public function habitsScheduledForDate(CarbonInterface $date, ?int $userId = null): Collection
    {
        $dateJst = $this->normalizeDate($date);

        $query = Habit::query();
        if (!is_null($userId)) {
            $query->where('user_id', $userId);
        }

        return $query->get()->filter(function (Habit $habit) use ($dateJst) {
            return $habit->isScheduledFor($dateJst);
        })->values();
    }
}