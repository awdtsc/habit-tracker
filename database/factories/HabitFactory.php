<?php

namespace Database\Factories;

use App\Models\Habit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class HabitFactory extends Factory
{
    protected $model = Habit::class;

    public function definition(): array
    {
        return [
            'user_id'        => User::factory(),
            'title'          => $this->faker->randomElement(['読書','瞑想','筋トレ','散歩']),
            'description'    => $this->faker->sentence(6),
            // NOT NULL 対策：必ず入れる
            'frequency_type' => 'daily',     // ← これが無くて落ちてた
            // daily なら days_of_week は不要。weeklyにしたい場合は下の state を使う
            'days_of_week'   => null,
            'target_times'   => 1,
            'start_date'     => now()->toDateString(),
            'end_date'       => null,
            'archived'       => false,
            // カラムは integer 想定（0=終日）。テストで文字列を指定されたら上書きされるので問題なし
            'time_slot'      => 0,
            'category'       => null,
            'color_tag'      => null,
            'evaluation_type'=> 'check',     // or 'self'
        ];
    }

    // 週単位運用が欲しい時に使う state（テストで呼べる）
    public function weekly(array $daysIso = [1,2,3,4,5,6,7]): static
    {
        return $this->state(fn () => [
            'frequency_type' => 'weekly',
            'days_of_week'   => $daysIso, // ISO: 1=Mon .. 7=Sun
        ]);
    }

    public function selfEvaluation(): static
    {
        return $this->state(fn () => ['evaluation_type' => 'self']);
    }
}