<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RemindTaskStoreRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'habit_log_id' => ['required','integer','exists:habit_logs,id'],
            'preset'       => ['nullable','in:5m,10m,1h,custom'],
            'minutes'      => ['nullable','integer','min:1','max:1440'], // custom用
        ];
    }
}