<?php

namespace App\Actions\Transactions;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\SupplyTransaction;
use App\Services\ActivityRecorder;
use App\Services\StockLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Corrects a recorded receipt or issue line (a typing mistake in the
 * quantity, price, date or IAR number), and keeps everything stored beside
 * it in step: the stock on hand, later lines' balances and, for an RIS
 * line, the RIS's issued quantity. Logged with the reason and before → after.
 */
class CorrectTransaction
{
    /** What may be corrected on each kind of line. */
    public const FIELDS = [
        SupplyTransaction::RECEIPT => ['transaction_date', 'reference_no', 'quantity', 'unit_cost', 'remarks'],
        SupplyTransaction::ISSUE => ['transaction_date', 'quantity', 'department_id', 'remarks'],
    ];

    public function __construct(
        private readonly StockLedger $ledger,
        private readonly ActivityRecorder $recorder,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated values (UpdateSupplyTransactionRequest)
     * @return bool whether anything changed
     *
     * @throws ValidationException
     */
    public function handle(SupplyTransaction $transaction, array $data, string $reason): bool
    {
        $fields = self::FIELDS[$transaction->transaction_type] ?? null;

        if ($fields === null) {
            throw ValidationException::withMessages(['reason' => 'Re-value lines are corrected from Stocks, not here.']);
        }

        return DB::transaction(function () use ($transaction, $data, $reason, $fields) {
            $rows = $this->ledger->lockItem((int) $transaction->supply_id);
            $line = SupplyTransaction::query()->whereKey($transaction->getKey())->lockForUpdate()->firstOrFail();
            $lowestBefore = $this->ledger->lowestBalance((int) $line->supply_id);
            $stockBefore = (int) $rows->sum('quantity_on_hand');
            $oldQuantity = (int) $line->quantity;
            $oldTotal = (float) $line->total_cost;

            $data = array_intersect_key($data, array_flip($fields));

            // Blank remarks stay as they were stored ('' or null).
            if (($data['remarks'] ?? null) === null && ($line->remarks ?? '') === '') {
                unset($data['remarks']);
            }

            $line->fill($data);

            // The cost as stored (up to 4 decimals) unless it was changed.
            $unitCost = $line->isDirty('unit_cost')
                ? (float) $data['unit_cost']
                : (float) $line->getRawOriginal('unit_cost');
            $line->total_cost = round((int) $line->quantity * $unitCost, 4);

            if (! $line->isDirty()) {
                return false;
            }

            $quantityChanged = $line->isDirty('quantity');
            $risItem = $quantityChanged ? $this->ledger->risItemFor($line) : null;
            $reorders = $quantityChanged || $line->isDirty('transaction_date');

            $line->save();
            $changes = $this->recorder->changesOf($line, ['balance_quantity']);

            // The ledger first, so a shortfall names the line it breaks.
            if ($reorders) {
                $this->ledger->rebalance((int) $line->supply_id, $lowestBefore);
            }

            if ($quantityChanged || (float) $line->total_cost !== $oldTotal) {
                $this->ledger->moveStock(
                    $line,
                    (int) $line->quantity - $oldQuantity,
                    $rows,
                    $risItem?->risSlip?->fund_cluster,
                );
            }

            $issued = $risItem ? $this->ledger->syncIssued($risItem, (string) $line->reference_no) : null;

            $line->loadMissing('supply:supply_id,item_name,stock_no');
            $this->recorder->record(
                ActivityAction::Updated,
                ActivityModule::Transactions,
                $line,
                changes: $changes,
                properties: array_filter([
                    'reason' => $reason,
                    'item' => $line->supply ? "{$line->supply->item_name} ({$line->supply->stock_no})" : null,
                    'reference' => $line->reference_no,
                    'stock_on_hand' => [$stockBefore, (int) $rows->sum('quantity_on_hand')],
                    'ris_quantity_issued' => $issued,
                ], fn ($value) => $value !== null),
                summary: 'Corrected: '.$reason,
            );

            return true;
        });
    }
}
