<?php

namespace App\Http\Requests\Settings;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ActivityLogFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('activity-logs.view');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'module' => ['nullable', Rule::enum(ActivityModule::class)],
            'action' => ['nullable', Rule::enum(ActivityAction::class)],
            'user' => ['nullable', 'integer', 'exists:users,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }
}
