<?php

use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/** One supply (ALCOHOL, id 1) with 10 on hand and a division to request for. */
function stockedSupply(): int
{
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'reorder_point' => 2, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_stocks')->insert(['supply_id' => 1, 'quantity_on_hand' => 10, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()]);

    return DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
}

function requestSupply(User $user, int $division, int $quantity)
{
    return test()->actingAs($user)->post(route('ris.store'), [
        'entity_name' => 'CHEDRO 12',
        'division' => $division,
        'office' => 'Technical Division',
        'fund_cluster' => '',
        'responsibility_center_code' => '',
        'purpose' => 'Office use',
        'supplies' => [['supply_id' => 1, 'quantity' => $quantity]],
        'signature_type' => 'sgd',
    ]);
}

/** The first query run inside a database transaction during $action. */
function firstQueryInTransaction(Closure $action): ?string
{
    $inTransaction = false;
    $first = null;

    Event::listen(TransactionBeginning::class, function () use (&$inTransaction) {
        $inTransaction = true;
    });
    DB::listen(function (QueryExecuted $query) use (&$inTransaction, &$first) {
        if ($inTransaction && $first === null) {
            $first = $query->sql;
        }
    });

    $action();

    return $first;
}

test('requests for the same supply are served first come, first served', function () {
    $division = stockedSupply();
    [$first, $second] = User::factory()->count(2)->create(['department_id' => $division]);

    requestSupply($first, $division, 8)->assertSessionHasNoErrors()->assertSessionHas('success');

    // 8 of the 10 are held by the first request, so 5 is too many…
    requestSupply($second, $division, 5)->assertSessionHasErrors([
        'supplies' => 'Stock availability has changed. Please review and update your request.',
        'supplies.0.quantity' => 'ALCOHOL: Only 2 units available (requested: 5)',
    ]);

    // …and what's left can still be requested.
    requestSupply($second, $division, 2)->assertSessionHasNoErrors()->assertSessionHas('success');

    expect(RisSlip::query()->where('status', 'draft')->count())->toBe(2)
        ->and((int) RisItem::query()->sum('quantity_requested'))->toBe(10);
});

test('a request locks the stock rows before checking them', function () {
    $division = stockedSupply();
    $staff = User::factory()->create(['department_id' => $division]);

    $sql = firstQueryInTransaction(fn () => requestSupply($staff, $division, 1)->assertSessionHas('success'));

    // SQLite leaves out "for update"; on MySQL this is the locking read.
    expect($sql)->toContain('from "supply_stocks"')
        ->toContain('order by "supply_id" asc, "stock_id" asc');
});

test('a manual RIS entry locks the stock rows before checking them', function () {
    $division = stockedSupply();
    $admin = User::factory()->admin()->create();
    $requester = User::factory()->create(['department_id' => $division]);

    $sql = firstQueryInTransaction(fn () => $this->actingAs($admin)->post(route('ris.store-manual'), [
        'is_manual_entry' => true,
        'ris_date' => now()->toDateString(),
        'reference_no' => '',
        'entity_name' => 'CHEDRO 12',
        'division' => $division,
        'office' => '',
        'fund_cluster' => '',
        'responsibility_center_code' => '',
        'requested_by' => $requester->id,
        'purpose' => 'Office use',
        'final_status' => 'declined',
        'decline_reason' => 'Duplicate request.',
        'items' => [['supply_id' => 1, 'quantity_requested' => 1]],
    ])->assertSessionHas('success'));

    expect($sql)->toContain('from "supply_stocks"')
        ->toContain('order by "supply_id" asc, "stock_id" asc')
        ->and(RisSlip::query()->where('is_manual_entry', true)->count())->toBe(1);
});
