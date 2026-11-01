<?php

namespace App\Actions\Transactions;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\SupplyTransaction;
use App\Services\ActivityRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gives every receipt line of an IAR a new IAR number (one typed wrong).
 * Only the reference changes, so no stock or balance moves. An IAR can't
 * list the same item twice: if the new number already has one of these
 * items, nothing is changed and the clashing items are named.
 */
class RenumberIar
{
    public function __construct(private readonly ActivityRecorder $recorder) {}

    /**
     * @return int lines renumbered
     *
     * @throws ValidationException
     */
    public function handle(string $from, string $to, string $reason): int
    {
        return DB::transaction(function () use ($from, $to, $reason) {
            $lines = SupplyTransaction::query()
                ->where('transaction_type', SupplyTransaction::RECEIPT)
                ->where('reference_no', $from)
                ->lockForUpdate()
                ->get(['transaction_id', 'supply_id']);

            if ($lines->isEmpty()) {
                throw ValidationException::withMessages(['from' => "There are no receipt lines with {$from}."]);
            }

            $clashes = SupplyTransaction::query()
                ->with('supply:supply_id,item_name')
                ->where('transaction_type', SupplyTransaction::RECEIPT)
                ->where('reference_no', $to)
                ->whereIn('supply_id', $lines->pluck('supply_id'))
                ->get(['transaction_id', 'supply_id'])
                ->map(fn (SupplyTransaction $line) => $line->supply->item_name ?? "Item #{$line->supply_id}")
                ->unique()
                ->values();

            if ($clashes->isNotEmpty()) {
                throw ValidationException::withMessages(['to' => sprintf(
                    '%s already has %s. Correct those lines one at a time instead.',
                    $to,
                    $clashes->take(3)->implode(', ').($clashes->count() > 3 ? ' and '.($clashes->count() - 3).' more' : ''),
                )]);
            }

            SupplyTransaction::query()->whereKey($lines->pluck('transaction_id'))->update(['reference_no' => $to]);

            $this->recorder->record(
                ActivityAction::Updated,
                ActivityModule::Transactions,
                changes: ['reference_no' => [$from, $to]],
                properties: ['reason' => $reason, 'lines' => $lines->count()],
                summary: 'Corrected: '.$reason,
                label: "{$from} → {$to}",
            );

            return $lines->count();
        });
    }
}
