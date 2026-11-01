<?php

namespace App\Services;

use App\Models\RisItem;
use App\Models\SupplyStock;
use App\Models\SupplyTransaction;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The values stored beside the transaction lines, kept in step with them
 * when a line is corrected: each line's "balance after", the stock on hand
 * (`supply_stocks`, one row per item and fund cluster) and an RIS item's
 * issued quantity. Reports that add the lines up when they are read (stock
 * card, ledger card, RSMI, RPCI) follow by themselves. Call inside a
 * database transaction, after `lockItem()`.
 */
class StockLedger
{
    /**
     * Locks the item's stock rows, the same lock RIS requests take, so a
     * correction and a request for the item never interleave. They come in
     * the order RIS issuing takes stock in (expiry, then oldest).
     *
     * @return Collection<int, SupplyStock>
     */
    public function lockItem(int $supplyId): Collection
    {
        return SupplyStock::query()
            ->where('supply_id', $supplyId)
            ->orderBy('expiry_date')
            ->orderBy('created_at')
            ->orderBy('stock_id')
            ->lockForUpdate()
            ->get();
    }

    /**
     * The item's lines in ledger order with the running balance after each:
     * receipts add, issues take away, adjustments (re-values, quantity 0)
     * pass it on. The same order the stock card, ledger card and RSMI use.
     *
     * @return list<array{line: SupplyTransaction, balance: int}>
     */
    public function walk(int $supplyId): array
    {
        $balance = 0;
        $steps = [];

        $lines = SupplyTransaction::query()
            ->where('supply_id', $supplyId)
            ->orderBy('transaction_date')
            ->orderBy('created_at')
            ->orderBy('transaction_id')
            ->get(['transaction_id', 'supply_id', 'transaction_type', 'transaction_date', 'reference_no', 'quantity', 'balance_quantity', 'created_at']);

        foreach ($lines as $line) {
            $balance += match ($line->transaction_type) {
                SupplyTransaction::RECEIPT => (int) $line->quantity,
                SupplyTransaction::ISSUE => -(int) $line->quantity,
                default => 0,
            };
            $steps[] = ['line' => $line, 'balance' => $balance];
        }

        return $steps;
    }

    /** The lowest the item's running balance goes (0 with no lines). */
    public function lowestBalance(int $supplyId): int
    {
        return min([0, ...array_column($this->walk($supplyId), 'balance')]);
    }

    /**
     * Rewrites each line's "balance after" where it changed, then refuses
     * the change if it makes the balance go below zero somewhere it didn't
     * before (`$lowestBefore`, from `lowestBalance()` ahead of the change).
     * Old dips from back-dated lines don't block an unrelated fix.
     *
     * @throws ValidationException
     */
    public function rebalance(int $supplyId, int $lowestBefore, string $errorKey = 'quantity'): void
    {
        foreach ($this->walk($supplyId) as ['line' => $line, 'balance' => $balance]) {
            if ($balance < 0 && $balance < $lowestBefore) {
                throw ValidationException::withMessages([$errorKey => sprintf(
                    '%s on %s would leave %s in stock. Correct that line first.',
                    $line->reference_no ?: 'Transaction #'.$line->transaction_id,
                    $line->transaction_date->format('M j, Y'),
                    number_format($balance),
                )]);
            }

            if ((int) $line->balance_quantity !== $balance) {
                SupplyTransaction::query()->whereKey($line->transaction_id)->update(['balance_quantity' => $balance]);
            }
        }
    }

    /**
     * Moves the stock on hand for a change to a line: `$quantityDelta` is
     * the change in the line's own quantity (a receipt +5 adds 5 to stock,
     * an issue +5 takes 5). Uses the same row the line came from or went
     * to: its fund cluster, else the RIS's, else the order issuing takes
     * stock in. The row's unit cost and value are then set from the
     * ledger's weighted average, the figures the ledger card shows. Call
     * after the line itself is saved (or deleted).
     *
     * @param  Collection<int, SupplyStock>  $rows  from lockItem()
     *
     * @throws ValidationException
     */
    public function moveStock(SupplyTransaction $line, int $quantityDelta, Collection $rows, ?string $risFund = null): void
    {
        $isReceipt = $line->transaction_type === SupplyTransaction::RECEIPT;
        $stockDelta = $isReceipt ? $quantityDelta : -$quantityDelta;
        $averageCost = $this->averageCost((int) $line->supply_id);
        $fund = $line->fund_cluster ?: $risFund;
        $row = $fund !== null ? $rows->first(fn (SupplyStock $stock) => (string) $stock->fund_cluster === (string) $fund) : null;

        if ($row === null && $rows->count() === 1) {
            $row = $rows->first();
        }

        if ($row !== null) {
            $this->adjustRow($row, $stockDelta, $averageCost);

            return;
        }

        // An old issue line without a fund cluster: take or give back in the
        // order RIS issuing uses (expiry, then oldest).
        $ordered = $rows->values();

        if ($ordered->isEmpty()) {
            throw ValidationException::withMessages(['quantity' => 'This item has no stock record to adjust.']);
        }

        if ($stockDelta > 0) {
            $this->adjustRow($ordered->first(), $stockDelta, $averageCost);

            return;
        }

        $remaining = -$stockDelta;

        foreach ($ordered as $stock) {
            $take = min($remaining, max(0, (int) $stock->quantity_on_hand));

            if ($take > 0) {
                $this->adjustRow($stock, -$take, $averageCost);
                $remaining -= $take;
            }

            if ($remaining === 0) {
                return;
            }
        }

        $this->adjustRow($ordered->last(), -$remaining, $averageCost);
    }

    /**
     * The RIS item an issue line belongs to (its reference is the RIS
     * number), or null for a manual line. Old manual entries can put one
     * RIS number on several slips (D18): if two of them have the item, which
     * one the line belongs to can't be told.
     *
     * @throws ValidationException
     */
    public function risItemFor(SupplyTransaction $line): ?RisItem
    {
        if ($line->transaction_type !== SupplyTransaction::ISSUE || ! $line->reference_no) {
            return null;
        }

        $items = RisItem::query()
            ->with('risSlip:ris_id,ris_no,fund_cluster')
            ->where('supply_id', $line->supply_id)
            ->whereHas('risSlip', fn ($slip) => $slip->where('ris_no', $line->reference_no))
            ->get();

        if ($items->count() > 1) {
            throw ValidationException::withMessages(['quantity' => "{$line->reference_no} has this item on more than one slip, so its quantity can't be corrected here."]);
        }

        return $items->first();
    }

    /**
     * Sets an RIS item's issued quantity to what its issue lines add up to.
     *
     * @return array{0: int, 1: int} issued before and after
     */
    public function syncIssued(RisItem $item, string $risNo): array
    {
        $before = (int) $item->quantity_issued;
        $after = (int) SupplyTransaction::query()
            ->where('transaction_type', SupplyTransaction::ISSUE)
            ->where('reference_no', $risNo)
            ->where('supply_id', $item->supply_id)
            ->sum('quantity');

        if ($before !== $after) {
            $item->forceFill(['quantity_issued' => $after])->save();
        }

        return [$before, $after];
    }

    /**
     * The item's weighted-average unit cost after its last line: receipts
     * add their cost, issues take stock away at the average. The same walk
     * the ledger card and RSMI do (RsmiAnalyticsService::correctUnitCosts).
     */
    public function averageCost(int $supplyId): float
    {
        $quantity = 0;
        $value = 0.0;
        $average = 0.0;

        $lines = SupplyTransaction::query()
            ->where('supply_id', $supplyId)
            ->orderBy('transaction_date')
            ->orderBy('created_at')
            ->orderBy('transaction_id')
            ->get(['transaction_type', 'quantity', 'total_cost', 'unit_cost', 'balance_quantity']);

        foreach ($lines as $line) {
            if ($line->transaction_type === SupplyTransaction::RECEIPT) {
                $quantity += (int) $line->quantity;
                $value += (float) $line->getRawOriginal('total_cost');
            } elseif ($line->transaction_type === SupplyTransaction::ISSUE) {
                $value = max(0.0, $value - $average * (int) $line->quantity);
                $quantity -= (int) $line->quantity;
            } elseif ((float) $line->getRawOriginal('unit_cost') > 0) {
                // A re-value sets the cost of what is on hand.
                $value = $quantity * (float) $line->getRawOriginal('unit_cost');
            }

            if ($quantity > 0) {
                $average = $value / $quantity;
            }
        }

        return $average;
    }

    /** @throws ValidationException */
    private function adjustRow(SupplyStock $stock, int $quantityDelta, float $averageCost): void
    {
        $quantity = (int) $stock->quantity_on_hand + $quantityDelta;

        if ($quantity < 0) {
            throw ValidationException::withMessages(['quantity' => sprintf(
                'Stock on hand (fund %s) would go below zero: %s.',
                $stock->fund_cluster ?? '—',
                number_format($quantity),
            )]);
        }

        $attributes = [
            'quantity_on_hand' => $quantity,
            'unit_cost' => round($averageCost, 2),
            'total_cost' => round($quantity * $averageCost, 4),
        ];

        if ($quantity <= 0) {
            $attributes['status'] = 'depleted';
        } elseif ($stock->status === 'depleted') {
            $attributes['status'] = 'available';
        }

        $stock->forceFill($attributes)->save();
    }
}
