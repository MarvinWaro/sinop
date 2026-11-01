<?php

namespace App\Http\Requests\Transactions;

use Illuminate\Foundation\Http\FormRequest;

/** Why a recorded line is deleted. Access is `can:transactions.delete`. */
class DeleteSupplyTransactionRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:5', 'max:500']];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'reason.required' => 'Say why it is being deleted.',
            'reason.min' => 'Say why it is being deleted.',
        ];
    }
}
