<?php

namespace App\Http\Requests\Transactions;

use Illuminate\Foundation\Http\FormRequest;

/** A whole IAR's new number, and why. Access is `can:transactions.update`. */
class RenumberIarRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'from' => ['required', 'string', UpdateSupplyTransactionRequest::IAR_FORMAT],
            'to' => ['required', 'string', UpdateSupplyTransactionRequest::IAR_FORMAT, 'different:from'],
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'to.regex' => 'Use the IAR format, e.g. IAR 2026-03-009.',
            'to.different' => 'That is the same number.',
            'reason.required' => 'Say why it is being corrected.',
            'reason.min' => 'Say why it is being corrected.',
        ];
    }
}
