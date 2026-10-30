<?php

namespace App\Http\Requests;

use App\Enums\ActivityModule;
use App\Enums\NotificationKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** The Notifications page's tabs and filters. */
class NotificationFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['nullable', 'in:unread'],
            'search' => ['nullable', 'string', 'max:150'],
            'kind' => ['nullable', Rule::enum(NotificationKind::class)],
            'module' => ['nullable', Rule::enum(ActivityModule::class)],
        ];
    }

    /** @return array{status: string, search: string, kind: string, module: string} */
    public function filters(): array
    {
        $validated = $this->validated();

        return [
            'status' => (string) ($validated['status'] ?? ''),
            'search' => trim((string) ($validated['search'] ?? '')),
            'kind' => (string) ($validated['kind'] ?? ''),
            'module' => (string) ($validated['module'] ?? ''),
        ];
    }
}
