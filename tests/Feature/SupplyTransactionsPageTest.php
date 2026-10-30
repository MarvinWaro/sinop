<?php

use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Seeds: RIS 2026-05-068 (3 items, one division), IAR 2026-05-010 (2 items,
 * lines on two dates), and an older RIS typed in last, so "recorded" order
 * and "transaction date" order differ.
 */
function seedTransactions(): array
{
    $user = User::factory()->admin()->create(['name' => 'Recorder']);
    $division = DB::table('departments')->insertGetId(['name' => 'Records Unit', 'created_at' => now(), 'updated_at' => now()]);
    $other = DB::table('departments')->insertGetId(['name' => 'Cashier', 'created_at' => now(), 'updated_at' => now()]);

    foreach ([1 => 'ENVELOPE', 2 => 'SIGN PEN', 3 => 'REFILL INK'] as $id => $name) {
        DB::table('supplies')->insert([
            'supply_id' => $id, 'stock_no' => sprintf('%02d', $id), 'item_name' => $name,
            'unit_of_measurement' => 'PIECE', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    $line = function (array $values) use ($user) {
        DB::table('supply_transactions')->insert([
            'quantity' => 1, 'unit_cost' => 10, 'total_cost' => 10, 'balance_quantity' => 5,
            'user_id' => $user->id, 'fund_cluster' => '101', 'updated_at' => now(), ...$values,
        ]);
    };

    foreach ([1, 2, 3] as $supply) {
        $line(['supply_id' => $supply, 'transaction_type' => 'issue', 'reference_no' => 'RIS 2026-05-068',
            'transaction_date' => '2026-05-12', 'department_id' => $division, 'quantity' => $supply, 'total_cost' => 10 * $supply,
            'created_at' => '2026-05-12 08:00:00']);
    }
    $line(['supply_id' => 1, 'transaction_type' => 'receipt', 'reference_no' => 'IAR 2026-05-010',
        'transaction_date' => '2026-05-02', 'department_id' => $division, 'created_at' => '2026-05-02 08:00:00']);
    $line(['supply_id' => 2, 'transaction_type' => 'receipt', 'reference_no' => 'IAR 2026-05-010',
        'transaction_date' => '2026-05-04', 'department_id' => $division, 'created_at' => '2026-05-04 08:00:00']);
    // Older slip, typed in last.
    $line(['supply_id' => 3, 'transaction_type' => 'issue', 'reference_no' => 'RIS 2026-01-001',
        'transaction_date' => '2026-01-15', 'department_id' => $other, 'fund_cluster' => '151', 'created_at' => '2026-06-01 08:00:00']);

    $slip = RisSlip::create(['ris_no' => 'RIS 2026-05-068', 'ris_date' => '2026-05-12', 'entity_name' => 'CHED', 'division' => $division, 'requested_by' => $user->id, 'status' => 'posted']);

    return [$user, $slip, $division];
}

test('documents view groups item lines by reference, newest transaction date first', function () {
    [$user, $slip] = seedTransactions();

    $this->actingAs($user)
        ->get(route('supply-transactions.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('transactions/index')
            ->where('view', 'documents')
            ->where('totals.documents', 3)
            ->where('totals.lines', 6)
            ->has('documents.data', 3)
            ->where('documents.data.0.reference_no', 'RIS 2026-05-068')
            ->where('documents.data.0.line_count', 3)
            ->where('documents.data.0.item_count', 3)
            ->where('documents.data.0.total_value', fn ($value) => (float) $value === 60.0)
            ->where('documents.data.0.division', 'Records Unit')
            ->where('documents.data.0.recorded_by', 'Recorder')
            ->where('documents.data.0.ris_key', $slip->route_key)
            ->has('documents.data.0.lines', 3)
            // the IAR has lines on two dates: one document with a date range
            ->where('documents.data.1.reference_no', 'IAR 2026-05-010')
            ->where('documents.data.1.date_from', '2026-05-02')
            ->where('documents.data.1.date_to', '2026-05-04')
            // the older RIS comes last although it was typed in last
            ->where('documents.data.2.reference_no', 'RIS 2026-01-001'));
});

test('searching an item shows its whole document; filters narrow documents', function () {
    [$user, , $division] = seedTransactions();

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['search' => 'refill']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.documents', 2)
            ->where('documents.data.0.reference_no', 'RIS 2026-05-068')
            ->has('documents.data.0.lines', 3));

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['type' => 'receipt']))
        ->assertInertia(fn (Assert $page) => $page->where('totals.documents', 1)->where('documents.data.0.reference_no', 'IAR 2026-05-010'));

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['fund' => '151']))
        ->assertInertia(fn (Assert $page) => $page->where('totals.documents', 1)->where('documents.data.0.reference_no', 'RIS 2026-01-001'));

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['division' => $division, 'from' => '2026-05-10']))
        ->assertInertia(fn (Assert $page) => $page->where('totals.documents', 1)->where('documents.data.0.reference_no', 'RIS 2026-05-068'));
});

test('item lines view still lists one row per line, by transaction date', function () {
    [$user] = seedTransactions();

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['view' => 'lines']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('view', 'lines')
            ->has('txns.data', 6)
            ->where('txns.data.0.reference_no', 'RIS 2026-05-068')
            ->where('txns.data.5.reference_no', 'RIS 2026-01-001')
            ->has('txns.data.0.supply'));

    $this->actingAs($user)
        ->get(route('supply-transactions.index', ['view' => 'lines', 'type' => 'receipt']))
        ->assertInertia(fn (Assert $page) => $page->has('txns.data', 2));
});

test('the transactions page keeps its permission', function () {
    $this->actingAs(User::factory()->cao()->create())
        ->get(route('supply-transactions.index'))
        ->assertOk();

    $this->actingAs(User::factory()->create())
        ->get(route('supply-transactions.index'))
        ->assertRedirect('/staff-dashboard');
});
