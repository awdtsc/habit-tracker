<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

use App\Models\Habit;
use App\Models\HabitTime;
use App\Services\DailyInitService;

class HabitController extends Controller
{
    /**
     * GET /api/habits
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $habits = Habit::query()
            ->where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->with('times')
            ->get();

        return response()->json(['habits' => $habits]);
    }

    /**
     * POST /api/habits
     * notify_time を受けたら habit_times を1件作成し、
     * その後に当日分の HabitLog / RemindTask（未来のみ）を生成する。
     */
    public function store(Request $request, DailyInitService $initService)
    {
        $user = $request->user();

        $data = $request->validate([
            'title'            => ['required','string','max:255'],
            'description'      => ['nullable','string'],
            'frequency_type'   => ['required', Rule::in(['daily','weekdays','weekends','custom','quota'])],
            'days_of_week'     => ['nullable','array'],
            'days_of_week.*'   => ['integer','between:1,7'],
            'weekly_quota'     => ['nullable','integer','min:1','max:7'],
            'start_date'       => ['nullable','date'],
            'end_date'         => ['nullable','date','after_or_equal:start_date'],
            'time_slot'        => ['nullable', Rule::in(['anytime','morning','noon','evening','night'])],
            'evaluation_type'  => ['nullable', Rule::in(['simple','self'])],
            'category'         => ['nullable','string','max:255'],
            'color_tag'        => ['nullable','string','max:20'],
            'notify_time'      => ['nullable','date_format:H:i'],        // 'HH:MM'
            'remind_offset'    => ['nullable','integer','between:-1440,1440'],
        ]);

        Log::debug('[Api.Habit.store] validated', $data);

        $result = DB::transaction(function () use ($user, $data) {
            // habits 用データ
            $habitData = Arr::only($data, [
                'title','description','frequency_type','days_of_week',
                'start_date','end_date','evaluation_type','category','color_tag',
            ]);

            if (isset($data['weekly_quota'])) {
                $habitData['target_times'] = ['weekly' => (int) $data['weekly_quota']];
            }

            $habitData['time_slot'] = isset($data['time_slot'])
                ? match ($data['time_slot']) {
                    'anytime' => 0, 'morning' => 1, 'noon' => 2, 'evening' => 3, 'night' => 4,
                }
                : 0;

            $habitData['days_of_week'] = $habitData['days_of_week'] ?? [];
            $habitData['user_id']      = $user->id;

            $habit = Habit::create($habitData);

            // ---- habit_times の作成（notify_time がキーとして送られている場合のみ）
            $createdTimes = 0;

            if (array_key_exists('notify_time', $data)) {
                $notify = $data['notify_time'];      // null or 'HH:MM'
                $offset = (int) ($data['remind_offset'] ?? 0);
                if ($notify !== null && $notify !== '') {
                    // MySQL TIME 互換に 'HH:MM:SS' 化（'11:30' → '11:30:00'）
                    $nt = strlen($notify) === 5 ? ($notify . ':00') : $notify;

                    $ht = HabitTime::create([
                        'habit_id'      => $habit->id,
                        'time_slot'     => $habitData['time_slot'],
                        'notify_time'   => $nt,
                        'remind_offset' => $offset,
                    ]);
                    $createdTimes++;
                    Log::info("[Api.Habit.store] habit_times created id={$ht->id} for habit={$habit->id}, notify_time={$nt}, offset={$offset}");
                } else {
                    Log::info("[Api.Habit.store] notify_time empty → habit_times を作成しません");
                }
            } else {
                Log::info("[Api.Habit.store] notify_time key not present → habit_times を作成しません");
            }

            return [
                'habit'         => $habit->fresh('times'),
                'created_times' => $createdTimes,
            ];
        });

        // ★ 当日分の HabitLog / RemindTask を生成（未来のみ）
        $init = $initService->initHabitForDate($result['habit'], Carbon::today(), Carbon::now());

        return response()->json([
            'message'       => 'created',
            'habit'         => $result['habit'],
            'created_times' => $result['created_times'],
            'init_result'   => $init, // {createdLogs, createdTasks}
        ], 201);
    }

    /**
     * GET /api/habits/{habit}
     */
    public function show(Request $request, Habit $habit)
    {
        $this->authorizeOwner($request, $habit);
        return response()->json(['habit' => $habit->load('times')]);
    }

    /**
     * PUT/PATCH /api/habits/{habit}
     * notify_time の upsert / 削除後に当日分初期化（未来のみ）を実行する。
     */
    public function update(Request $request, Habit $habit, DailyInitService $initService)
    {
        $this->authorizeOwner($request, $habit);

        $data = $request->validate([
            'title'            => ['sometimes','required','string','max:255'],
            'description'      => ['nullable','string'],
            'frequency_type'   => ['sometimes', Rule::in(['daily','weekdays','weekends','custom','quota'])],
            'days_of_week'     => ['nullable','array'],
            'days_of_week.*'   => ['integer','between:1,7'],
            'weekly_quota'     => ['nullable','integer','min:1','max:7'],
            'start_date'       => ['nullable','date'],
            'end_date'         => ['nullable','date','after_or_equal:start_date'],
            'time_slot'        => ['nullable', Rule::in(['anytime','morning','noon','evening','night'])],
            'evaluation_type'  => ['nullable', Rule::in(['simple','self'])],
            'category'         => ['nullable','string','max:255'],
            'color_tag'        => ['nullable','string','max:20'],
            'notify_time'      => ['nullable','date_format:H:i'],        // 'HH:MM'
            'remind_offset'    => ['nullable','integer','between:-1440,1440'],
        ]);

        Log::debug('[Api.Habit.update] validated', $data);

        $result = DB::transaction(function () use ($habit, $data) {
            $updates = Arr::only($data, [
                'title','description','frequency_type','days_of_week',
                'start_date','end_date','evaluation_type','category','color_tag',
            ]);

            if (array_key_exists('weekly_quota', $data)) {
                $tt = $habit->target_times ?? [];
                $tt['weekly'] = (int) $data['weekly_quota'];
                $updates['target_times'] = $tt;
            }

            if (array_key_exists('time_slot', $data)) {
                $updates['time_slot'] = match ($data['time_slot']) {
                    'anytime' => 0, 'morning' => 1, 'noon' => 2, 'evening' => 3, 'night' => 4,
                };
            }

            if (array_key_exists('days_of_week', $data) && $data['days_of_week'] === null) {
                $updates['days_of_week'] = [];
            }

            if (!empty($updates)) {
                $habit->fill($updates)->save();
            }

            $changedTimes = false;

            // notify_time キーが送られていれば upsert / 削除を判断
            if (array_key_exists('notify_time', $data)) {
                $notify = $data['notify_time'];              // null or 'HH:MM'
                $slot   = $updates['time_slot'] ?? $habit->time_slot ?? 0;

                if ($notify === null || $notify === '') {
                    $cnt = HabitTime::where('habit_id', $habit->id)
                        ->where('time_slot', $slot)
                        ->delete();
                    $changedTimes = $changedTimes || $cnt > 0;
                    Log::info("[Api.Habit.update] habit_times deleted count={$cnt} habit={$habit->id} slot={$slot}");
                } else {
                    $nt = strlen($notify) === 5 ? ($notify . ':00') : $notify;
                    $rec = HabitTime::updateOrCreate(
                        ['habit_id' => $habit->id, 'time_slot' => $slot],
                        [
                            'notify_time'   => $nt,
                            'remind_offset' => (int)($data['remind_offset'] ?? 0),
                        ]
                    );
                    $changedTimes = true;
                    Log::info("[Api.Habit.update] habit_times upserted id={$rec->id} habit={$habit->id} slot={$slot} notify_time={$nt}");
                }
            }

            return [
                'habit'         => $habit->fresh('times'),
                'changed_times' => $changedTimes,
            ];
        });

        // ★ 当日分の HabitLog / RemindTask を生成（未来のみ）
        $init = $initService->initHabitForDate($result['habit'], Carbon::today(), Carbon::now());

        return response()->json([
            'message'       => 'updated',
            'habit'         => $result['habit'],
            'changed_times' => $result['changed_times'],
            'init_result'   => $init, // {createdLogs, createdTasks}
        ]);
    }

    /**
     * DELETE /api/habits/{habit}
     */
    public function destroy(Request $request, Habit $habit)
    {
        $this->authorizeOwner($request, $habit);
        $habit->delete();
        return response()->json(['message' => 'deleted']);
    }

    private function authorizeOwner(Request $request, Habit $habit): void
    {
        abort_if($habit->user_id !== $request->user()->id, 403, 'Forbidden');
    }
}