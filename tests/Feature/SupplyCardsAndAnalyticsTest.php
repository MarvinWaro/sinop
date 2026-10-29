<?php

use App\Models\User;
use App\Services\RsmiAnalyticsService;
use App\Services\SupplyCardNavigation;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function seedSupply(int $id, bool $withStock = true): void
{
    DB::table('supplies')->insert([
        'supply_id' => $id,
        'stock_no' => sprintf('%02d', $id),
        'item_name' => "ITEM {$id}",
        'unit_of_measurement' => 'PIECE',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    if ($withStock) {
        DB::table('supply_stocks')->insert([
            'supply_id' => $id,
            'quantity_on_hand' => 5,
            'unit_cost' => 5,
            'total_cost' => 25,
            'status' => 'available',
            'fund_cluster' => '101',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

function seedTransaction(int $supplyId, int $userId, string $type, string $date, int $quantity, float $unitCost, int $balance, string $reference): void
{
    DB::table('supply_transactions')->insert([
        'supply_id' => $supplyId,
        'transaction_type' => $type,
        'transaction_date' => $date,
        'reference_no' => $reference,
        'quantity' => $quantity,
        'unit_cost' => $unitCost,
        'total_cost' => $quantity * $unitCost,
        'balance_quantity' => $balance,
        'user_id' => $userId,
        'created_at' => "{$date} 08:00:00",
        'updated_at' => "{$date} 08:00:00",
    ]);
}

test('card navigation steps through supplies that have stock records', function () {
    seedSupply(1);
    seedSupply(2);
    seedSupply(3, withStock: false);
    seedSupply(4);

    $nav = app(SupplyCardNavigation::class);

    $middle = $nav->for(2);
    expect($middle['previous']['supply_id'])->toBe(1)
        ->and($middle['next']['supply_id'])->toBe(4)
        ->and($middle['position'])->toBe(2)
        ->and($middle['total'])->toBe(3);

    expect($nav->for(1)['previous'])->toBeNull()
        ->and($nav->for(4)['next'])->toBeNull()
        ->and($nav->for(4)['position'])->toBe(3);
});

test('yearly analytics splits issuances into semesters that add up to the year', function () {
    $user = User::factory()->admin()->create();
    seedSupply(1);

    // Receipt at ₱5, then issues in March (1st semester) and August (2nd).
    seedTransaction(1, $user->id, 'receipt', '2026-01-10', 10, 5, 10, 'IAR 2026-01-001');
    seedTransaction(1, $user->id, 'issue', '2026-03-15', 2, 5, 8, 'RIS 2026-03-001');
    seedTransaction(1, $user->id, 'issue', '2026-08-20', 3, 5, 5, 'RIS 2026-08-001');

    $data = app(RsmiAnalyticsService::class)->yearly(2026, '101');
    $semesters = collect($data['semester_data']);

    expect($semesters)->toHaveCount(2)
        ->and((float) $semesters[0]['total'])->toEqual(10.0)
        ->and((float) $semesters[1]['total'])->toEqual(15.0)
        ->and($semesters[0]['ris_count'])->toBe(1)
        ->and($semesters[1]['items'])->toBe(1)
        ->and((float) $semesters->sum('total'))->toEqual((float) $data['summary']['total_value'])
        ->and($data)->toHaveKeys(['summary', 'monthly_breakdown', 'quarterly_data', 'top_categories', 'top_items', 'insights']);
});

test('stock and ledger cards include previous and next items', function (string $route, string $component) {
    // The card pages use MySQL date functions (YEAR(), MONTH()).
    if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'])) {
        $this->markTestSkipped('The card pages require MySQL or MariaDB.');
    }

    seedSupply(1);
    seedSupply(2);

    $this->actingAs(User::factory()->admin()->create())
        ->get(route($route, 1))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component($component)
            ->where('navigation.previous', null)
            ->where('navigation.next.supply_id', 2));
})->with([
    ['stock-cards.show', 'stock-cards/show'],
    ['supply-ledger-cards.show', 'ledger-cards/show'],
]);
