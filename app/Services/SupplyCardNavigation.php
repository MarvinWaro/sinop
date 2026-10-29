<?php

namespace App\Services;

use App\Models\Supply;
use Illuminate\Database\Eloquent\Builder;

/**
 * Previous / next item for the Stock Card and Supply Ledger Card pages, so
 * users can step through cards without going back to the list.
 *
 * Uses the same set as the card lists (supplies with at least one stock
 * record) in the lists' order (supply_id).
 */
class SupplyCardNavigation
{
    /**
     * @return array{previous: array<string, mixed>|null, next: array<string, mixed>|null, position: int, total: int}
     */
    public function for(int $supplyId): array
    {
        $columns = ['supply_id', 'item_name', 'stock_no'];

        $previous = $this->withStock()
            ->where('supply_id', '<', $supplyId)
            ->orderByDesc('supply_id')
            ->first($columns);

        $next = $this->withStock()
            ->where('supply_id', '>', $supplyId)
            ->orderBy('supply_id')
            ->first($columns);

        return [
            'previous' => $previous?->only($columns),
            'next' => $next?->only($columns),
            'position' => $this->withStock()->where('supply_id', '<=', $supplyId)->count(),
            'total' => $this->withStock()->count(),
        ];
    }

    private function withStock(): Builder
    {
        return Supply::query()->whereExists(function ($query) {
            $query->selectRaw('1')
                ->from('supply_stocks')
                ->whereColumn('supply_stocks.supply_id', 'supplies.supply_id');
        });
    }
}
