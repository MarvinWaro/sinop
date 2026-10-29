<?php

namespace App\Support;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\SupplyStock;
use App\Services\ActivityRecorder;
use Illuminate\Support\Str;

/**
 * One activity log entry per RIS step (requested, approved, declined,
 * issued, received, manual entry), with the slip's item lines inside it.
 */
class RisActivity
{
    /**
     * @param  bool  $withStock  Add each item's available stock before → after (for steps that move stock).
     * @param  array<string, mixed>  $properties  Extra details, such as a decline reason.
     */
    public static function record(
        ActivityAction $action,
        RisSlip $risSlip,
        ?string $summary = null,
        array $properties = [],
        bool $withStock = false,
    ): void {
        $risSlip->loadMissing(['items.supply', 'department']);

        $lines = $risSlip->items->map(function (RisItem $item) use ($withStock): array {
            $line = [
                'item' => $item->supply ? "{$item->supply->item_name} ({$item->supply->stock_no})" : "Supply #{$item->supply_id}",
                'requested' => (int) $item->quantity_requested,
            ];

            if ($item->quantity_issued !== null) {
                $line['issued'] = (int) $item->quantity_issued;
            }

            if ($withStock) {
                $after = (int) SupplyStock::where('supply_id', $item->supply_id)
                    ->where('status', 'available')
                    ->sum('quantity_on_hand');
                $line['stock_before'] = $after + (int) ($item->quantity_issued ?? 0);
                $line['stock_after'] = $after;
            }

            return $line;
        })->values()->all();

        $count = count($lines);
        $summary ??= collect([
            $count.' '.Str::plural('item', $count),
            $risSlip->department?->name,
            $risSlip->fund_cluster ? "Fund cluster {$risSlip->fund_cluster}" : null,
        ])->filter()->join(' · ');

        app(ActivityRecorder::class)->record(
            $action,
            ActivityModule::Ris,
            $risSlip,
            properties: ['items' => $lines, ...$properties],
            summary: $summary,
        );
    }
}
