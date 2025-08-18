<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HabitLog extends Model
{
    use HasFactory;

    protected $fillable = ['habit_id','user_id','date','status','note','checked_at'];

    protected $casts = [
        'date'       => 'date',
        'checked_at' => 'datetime',
        'status'     => 'boolean', // ← 唯一の真実
    ];

    public function habit() { return $this->belongsTo(Habit::class); }
    public function user()  { return $this->belongsTo(User::class);  }
}
