<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\HabitLog;
use Illuminate\Support\Facades\Auth;

class HabitLogController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'habit_id' => 'required|exists:habits,id',
            'date' => 'required|date',
        ]);

        $status = $request->has('done') ? 1 : 0;

        HabitLog::updateOrCreate(
            [
                'habit_id' => $validated['habit_id'],
                'user_id' => Auth::id(),
                'date' => $validated['date'],
            ],
            [
                'status' => $status,
                'checked_at' => $status ? now() : null,
            ]
        );

        return redirect()->route('dashboard')->with('success', '記録を保存しました');
    }
}
