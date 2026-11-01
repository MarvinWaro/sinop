<?php

namespace App\Http\Requests\Transactions;

use App\Models\SupplyTransaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A correction to a recorded line: the fields its kind allows (see
 * CorrectTransaction::FIELDS) and why. Access is the route's
 * `can:transactions.update`.
 */
class UpdateSupplyTransactionRequest extends FormRequest
{
    /** The IAR number format receiving uses (SupplyStockController). */
    public const IAR_FORMAT = 'regex:/^IAR \d{4}-\d{2}-\d{3}$/';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        /** @var SupplyTransaction $line */
        $line = $this->route('transaction');

        $rules = [
            'reason' => ['required', 'string', 'min:5', 'max:500'],
            'transaction_date' => ['required', 'date', 'before_or_equal:today'],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'remarks' => ['nullable', 'string', 'max:255'],
        ];

        if ($line->transaction_type === SupplyTransaction::RECEIPT) {
            $rules['unit_cost'] = ['required', 'numeric', 'min:0', 'max:99999999'];
            // An IAR lists an item once (as when it was received).
            $rules['reference_no'] = [
                'required', 'string', self::IAR_FORMAT,
                Rule::unique('supply_transactions', 'reference_no')
                    ->where('supply_id', $line->supply_id)
                    ->where('transaction_type', SupplyTransaction::RECEIPT)
                    ->ignore($line->getKey(), 'transaction_id'),
            ];
        }

        if ($line->transaction_type === SupplyTransaction::ISSUE) {
            $rules['department_id'] = ['nullable', 'integer', 'exists:departments,id'];
        }

        return $rules;
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'reference_no.regex' => 'Use the IAR format, e.g. IAR 2026-03-009.',
            'reference_no.unique' => 'That IAR already has this item.',
            'transaction_date.before_or_equal' => 'The date can’t be in the future.',
            'reason.required' => 'Say why it is being corrected.',
            'reason.min' => 'Say why it is being corrected.',
        ];
    }
}
