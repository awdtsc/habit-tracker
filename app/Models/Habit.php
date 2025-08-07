<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Habit extends Model
{
    use HasFactory;

    // 保存を許可するカラムを明示する
    protected $fillable = [
        'user_id',
        'title',
        'description',
        'frequency_type',
        'start_date',
        'end_date',
    ];
}
