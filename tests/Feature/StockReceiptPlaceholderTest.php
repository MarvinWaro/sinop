<?php

use App\Models\Supply;
use App\Models\SupplyStock;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

function receive(TestCase $test, Supply $supply, string $iar, int $quantity, string $fund): void
{
    $test->post(route('stocks.store'), [
        'reference_no' => $iar,
        'receipt_date' => now()->toDateString(),
        'submission_token' => uniqid(),
        'items' => [['supply_id' => $supply->supply_id, 'quantity' => $quantity, 'unit_cost' => '50.00', 'fund_cluster' => $fund, 'status' => 'available']],
    ])->assertSessionHasNoErrors()->assertSessionHas('success');
}

test('the first delivery of a new supply fills its empty stock row instead of adding a second', function () {
    $this->actingAs(User::factory()->admin()->create());

    $this->post(route('supplies.store'), ['stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE'])
        ->assertSessionHas('success');
    $supply = Supply::query()->sole();
    expect(SupplyStock::query()->sole()->fund_cluster)->toBeNull();

    receive($this, $supply, 'IAR 2026-10-001', 10, '101');

    $stock = SupplyStock::query()->sole();
    expect($stock->fund_cluster)->toBe('101')
        ->and($stock->quantity_on_hand)->toBe(10)
        ->and($stock->status)->toBe('available');

    // More of the same fund cluster adds to it; another fund cluster is its own row.
    receive($this, $supply, 'IAR 2026-10-002', 5, '101');
    receive($this, $supply, 'IAR 2026-10-003', 3, '151');

    expect(SupplyStock::query()->orderBy('fund_cluster')->pluck('quantity_on_hand', 'fund_cluster')->all())
        ->toBe(['101' => 15, '151' => 3]);
});

test('the clean-up removes only empty rows that sit beside a real one', function () {
    $now = now();
    DB::table('supplies')->insert([
        ['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE', 'created_at' => $now, 'updated_at' => $now],
        ['supply_id' => 2, 'stock_no' => '02', 'item_name' => 'PAPER', 'unit_of_measurement' => 'REAM', 'created_at' => $now, 'updated_at' => $now],
    ]);
    $row = fn (int $supply, ?string $fund, int $quantity) => ['supply_id' => $supply, 'fund_cluster' => $fund, 'quantity_on_hand' => $quantity, 'unit_cost' => 0, 'total_cost' => 0, 'status' => $quantity ? 'available' : 'depleted', 'created_at' => $now, 'updated_at' => $now];
    DB::table('supply_stocks')->insert([
        $row(1, null, 0),  // the duplicate: ALCOHOL was received into 101
        $row(1, '101', 10),
        $row(2, null, 0),  // PAPER was never received: stays, so it shows in Stocks
    ]);

    $cleanUp = require database_path('migrations/2026_10_31_000007_remove_empty_stock_rows_beside_fund_rows.php');
    $cleanUp->up();
    $cleanUp->up();

    expect(DB::table('supply_stocks')->orderBy('supply_id')->get(['supply_id', 'fund_cluster'])->map(fn ($stock) => [$stock->supply_id, $stock->fund_cluster])->all())
        ->toBe([[1, '101'], [2, null]]);
});
