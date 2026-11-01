<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Adding a supply makes an empty stock row with no fund cluster, so the item
 * shows in Stocks. Receiving it used to add a second row for the fund
 * cluster instead of filling that one (fixed in SupplyStockController), so
 * Stocks listed the item twice: "Depleted, 0" and the real one. This removes
 * those empty rows: no fund cluster, nothing on hand, no value, and another
 * row for the same supply. Items never received keep theirs. Safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        $ids = DB::table('supply_stocks')
            ->whereNull('fund_cluster')
            ->where('quantity_on_hand', 0)
            ->where('total_cost', 0)
            ->whereExists(fn (Builder $other) => $other->from('supply_stocks as other')
                ->whereColumn('other.supply_id', 'supply_stocks.supply_id')
                ->whereNotNull('other.fund_cluster'))
            ->pluck('stock_id');

        DB::table('supply_stocks')->whereIn('stock_id', $ids)->delete();
    }

    /** The removed rows were empty; nothing to put back. */
    public function down(): void {}
};
