<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReminderSnoozeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // 後でPolicy導入予定
    }

    public function rules(): array
    {
        return [
            'minutes'   => ['nullable','integer','min:1','max:1440'],
            'remind_at' => ['nullable','date'],
        ];
    }

    protected function passedValidation(): void
    {
        // minutes も remind_at も無い場合はデフォルト5分
        if (!$this->minutes && !$this->remind_at) {
            $this->merge(['minutes' => 5]);
        }
    }
}