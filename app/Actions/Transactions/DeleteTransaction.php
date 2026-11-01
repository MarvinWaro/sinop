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
 * Deletes a receipt or issue line recorded by mistake. Its quantity comes
 * off (or goes back into) the stock on hand, later lines' balances follow,
 * and an RIS line lowers the RIS's issued quantity. Refused when the stock
 * would go below zero. Logged with the reason and the line as it was.
 */
class DeleteTransaction
{
    public function __construct(
        private readonly StockLedger $ledger,
        private readonly ActivityRecorder $recorder,
    ) {}

    /** @throws ValidationException */
    public function handle(SupplyTransaction $transaction, string $reason): void
    {
        if (! isset(CorrectTransaction::FIELDS[$transaction->transaction_type])) {
            throw ValidationException::withMessages(['reason' => 'Re-value lines are corrected from Stocks, not here.']);
        }

        DB::transaction(function () use ($transaction, $reason) {
            $rows = $this->ledger->lockItem((int) $transaction->supply_id);
            $line = SupplyTransaction::query()->whereKey($transaction->getKey())->lockForUpdate()->firstOrFail();
            $line->loadMissing('supply:supply_id,item_name,stock_no');
            $lowestBefore = $this->ledger->lowestBalance((int) $line->supply_id);
            $stockBefore = (int) $rows->sum('quantity_on_hand');
            $risItem = $this->ledger->risItemFor($line);

            // The ledger first, so a shortfall names the line it breaks.
            $line->delete();
            $this->ledger->rebalance((int) $line->supply_id, $lowestBefore, 'reason');

            $this->ledger->moveStock(
                $line,
                -(int) $line->quantity,
                $rows,
                $risItem?->risSlip?->fund_cluster,
            );
            $issued = $risItem ? $this->ledger->syncIssued($risItem, (string) $line->reference_no) : null;

            // The log keeps the line as it was: the row itself is gone.
            $this->recorder->record(
                ActivityAction::Deleted,
                ActivityModule::Transactions,
                $line,
                properties: array_filter([
                    'reason' => $reason,
                    'item' => $line->supply ? "{$line->supply->item_name} ({$line->supply->stock_no})" : null,
                    'type' => $line->transaction_type,
                    'reference' => $line->reference_no,
                    'date' => $line->transaction_date->toDateString(),
                    'quantity' => (int) $line->quantity,
                    'unit_cost' => (float) $line->getRawOriginal('unit_cost'),
                    'fund_cluster' => $line->fund_cluster,
                    'stock_on_hand' => [$stockBefore, (int) $rows->sum('quantity_on_hand')],
                    'ris_quantity_issued' => $issued,
                ], fn ($value) => $value !== null),
                summary: 'Deleted: '.$reason,
            );
        });
    }
}
