<?php

use App\Models\ActivityLog;
use App\Models\RisSlip;
use App\Models\SupplyStock;
use App\Models\SupplyTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

/*
 * One item: IAR 2026-03-008 received 10 at ₱50 (fund 101), then RIS
 * 2026-03-001 issued 3 of them. Stock on hand 7.
 */
beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->division = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);

    foreach ([1 => 'ALCOHOL', 2 => 'BOND PAPER', 3 => 'STAPLER'] as $id => $name) {
        DB::table('supplies')->insert(['supply_id' => $id, 'stock_no' => "0{$id}", 'item_name' => $name, 'unit_of_measurement' => 'PIECE', 'created_at' => now(), 'updated_at' => now()]);
    }

    $this->stock = SupplyStock::query()->create(['supply_id' => 1, 'quantity_on_hand' => 7, 'unit_cost' => 50, 'total_cost' => 500, 'status' => 'available', 'fund_cluster' => '101']);

    $this->receipt = SupplyTransaction::query()->create([
        'supply_id' => 1, 'transaction_type' => 'receipt', 'transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008',
        'quantity' => 10, 'unit_cost' => 50, 'total_cost' => 500, 'balance_quantity' => 10, 'user_id' => $this->admin->id, 'fund_cluster' => '101',
    ]);

    $this->ris = RisSlip::create(['ris_no' => 'RIS 2026-03-001', 'ris_date' => '2026-03-05', 'entity_name' => 'CHED', 'division' => $this->division, 'requested_by' => $this->admin->id, 'status' => 'posted', 'fund_cluster' => '101']);
    $this->risItem = DB::table('ris_items')->insertGetId(['ris_id' => $this->ris->ris_id, 'supply_id' => 1, 'quantity_requested' => 3, 'quantity_issued' => 3, 'created_at' => now(), 'updated_at' => now()]);

    // Issued the way RIS issuing records it: no fund cluster on the line.
    $this->issue = SupplyTransaction::query()->create([
        'supply_id' => 1, 'transaction_type' => 'issue', 'transaction_date' => '2026-03-05', 'reference_no' => 'RIS 2026-03-001',
        'quantity' => 3, 'unit_cost' => 50, 'total_cost' => 150, 'balance_quantity' => 7, 'user_id' => $this->admin->id, 'department_id' => $this->division,
    ]);
});

function correct(SupplyTransaction $line, array $data): TestResponse
{
    return test()->actingAs(test()->admin)->put(route('supply-transactions.update', $line), $data + ['reason' => 'Typed the wrong figure']);
}

test('correcting a receipt moves the stock on hand and its value, and later balances follow', function () {
    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 12, 'unit_cost' => 55])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success');

    expect($this->receipt->fresh())
        ->quantity->toBe(12)
        ->total_cost->toBe('660.00')
        ->balance_quantity->toBe(12)
        ->and($this->issue->fresh()->balance_quantity)->toBe(9)
        ->and($this->stock->fresh())
        ->quantity_on_hand->toBe(9)
        // Priced like the ledger card: 12 at ₱55, 3 issued, 9 left at ₱55.
        ->unit_cost->toBe('55.00')
        ->total_cost->toBe('495.00');

    $log = ActivityLog::where('module', 'transactions')->where('action', 'updated')->sole();
    expect($log->properties['reason'])->toBe('Typed the wrong figure')
        ->and($log->changes['quantity'])->toBe([10, 12])
        ->and($log->properties['stock_on_hand'])->toBe([7, 9]);
});

test('correcting an RIS issue line also corrects the RIS issued quantity', function () {
    correct($this->issue, ['transaction_date' => '2026-03-05', 'quantity' => 1, 'department_id' => $this->division])
        ->assertSessionHasNoErrors();

    expect(DB::table('ris_items')->where('item_id', $this->risItem)->value('quantity_issued'))->toBe(1)
        ->and($this->stock->fresh()->quantity_on_hand)->toBe(9)
        ->and($this->issue->fresh()->balance_quantity)->toBe(9)
        ->and(ActivityLog::where('action', 'updated')->sole()->properties['ris_quantity_issued'])->toBe([3, 1]);
});

test('deleting an issue line puts the stock back and lowers the RIS issued quantity', function () {
    DB::table('user_transactions')->insert(['transaction_id' => $this->issue->transaction_id, 'user_id' => $this->admin->id, 'role' => 'requester', 'created_at' => now(), 'updated_at' => now()]);

    $this->actingAs($this->admin)
        ->delete(route('supply-transactions.destroy', $this->issue), ['reason' => 'Issued to the wrong RIS'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('deleted');

    expect(SupplyTransaction::find($this->issue->transaction_id))->toBeNull()
        ->and(DB::table('user_transactions')->count())->toBe(0)
        ->and($this->stock->fresh())->quantity_on_hand->toBe(10)->status->toBe('available')->total_cost->toBe('500.00')
        ->and(DB::table('ris_items')->where('item_id', $this->risItem)->value('quantity_issued'))->toBe(0)
        ->and(ActivityLog::where('action', 'deleted')->sole()->properties)->toMatchArray(['reason' => 'Issued to the wrong RIS', 'quantity' => 3]);
});

test('a change that would leave the stock below zero is refused and names the line it breaks', function () {
    $this->actingAs($this->admin)
        ->delete(route('supply-transactions.destroy', $this->receipt), ['reason' => 'Recorded twice'])
        ->assertSessionHasErrors(['reason' => 'RIS 2026-03-001 on Mar 5, 2026 would leave -3 in stock. Correct that line first.']);

    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 2, 'unit_cost' => 50])
        ->assertSessionHasErrors('quantity');

    // Nothing moved.
    expect(SupplyTransaction::count())->toBe(2)
        ->and($this->receipt->fresh()->quantity)->toBe(10)
        ->and($this->stock->fresh()->quantity_on_hand)->toBe(7)
        ->and(ActivityLog::where('module', 'transactions')->count())->toBe(0);
});

test('moving a receipt after the issue that used it is refused too', function () {
    correct($this->receipt, ['transaction_date' => '2026-03-10', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 10, 'unit_cost' => 50])
        ->assertSessionHasErrors('quantity');
});

test('an IAR number must keep the format and an IAR lists an item once', function () {
    SupplyTransaction::query()->create(['supply_id' => 1, 'transaction_type' => 'receipt', 'transaction_date' => '2026-03-02', 'reference_no' => 'IAR 2026-03-009', 'quantity' => 1, 'unit_cost' => 50, 'total_cost' => 50, 'balance_quantity' => 11, 'user_id' => $this->admin->id, 'fund_cluster' => '101']);

    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => '2026-03-010', 'quantity' => 10, 'unit_cost' => 50])
        ->assertSessionHasErrors(['reference_no' => 'Use the IAR format, e.g. IAR 2026-03-009.']);
    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-009', 'quantity' => 10, 'unit_cost' => 50])
        ->assertSessionHasErrors(['reference_no' => 'That IAR already has this item.']);
    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-010', 'quantity' => 10, 'unit_cost' => 50])
        ->assertSessionHasNoErrors();

    expect($this->receipt->fresh()->reference_no)->toBe('IAR 2026-03-010');
});

test('a whole IAR can be renumbered, unless the new number already has one of its items', function () {
    SupplyTransaction::query()->create(['supply_id' => 2, 'transaction_type' => 'receipt', 'transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 5, 'unit_cost' => 10, 'total_cost' => 50, 'balance_quantity' => 5, 'user_id' => $this->admin->id, 'fund_cluster' => '101']);
    SupplyTransaction::query()->create(['supply_id' => 3, 'transaction_type' => 'receipt', 'transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-009', 'quantity' => 5, 'unit_cost' => 10, 'total_cost' => 50, 'balance_quantity' => 5, 'user_id' => $this->admin->id, 'fund_cluster' => '101']);

    $this->actingAs($this->admin)
        ->put(route('supply-transactions.renumber'), ['from' => 'IAR 2026-03-008', 'to' => 'IAR 2026-03-009', 'reason' => 'Wrong IAR number'])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success', 'IAR 2026-03-008 changed to IAR 2026-03-009: 2 lines updated.');

    expect(SupplyTransaction::where('reference_no', 'IAR 2026-03-009')->count())->toBe(3)
        ->and(SupplyTransaction::where('reference_no', 'IAR 2026-03-008')->count())->toBe(0);

    $this->actingAs($this->admin)
        ->put(route('supply-transactions.renumber'), ['from' => 'IAR 2026-03-009', 'to' => 'IAR 2026-03-001', 'reason' => 'Testing a clash'])
        ->assertSessionHasNoErrors();
    SupplyTransaction::query()->create(['supply_id' => 1, 'transaction_type' => 'receipt', 'transaction_date' => '2026-03-02', 'reference_no' => 'IAR 2026-03-002', 'quantity' => 1, 'unit_cost' => 50, 'total_cost' => 50, 'balance_quantity' => 11, 'user_id' => $this->admin->id, 'fund_cluster' => '101']);

    $this->actingAs($this->admin)
        ->put(route('supply-transactions.renumber'), ['from' => 'IAR 2026-03-001', 'to' => 'IAR 2026-03-002', 'reason' => 'Testing a clash'])
        ->assertSessionHasErrors(['to' => 'IAR 2026-03-002 already has ALCOHOL. Correct those lines one at a time instead.']);
});

test('a reason is required, and re-value lines are not corrected here', function () {
    $this->actingAs($this->admin)
        ->put(route('supply-transactions.update', $this->receipt), ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 11, 'unit_cost' => 50])
        ->assertSessionHasErrors('reason');

    $adjustment = SupplyTransaction::query()->create(['supply_id' => 1, 'transaction_type' => 'adjustment', 'transaction_date' => '2026-03-06', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 0, 'unit_cost' => 60, 'total_cost' => 0, 'balance_quantity' => 7, 'user_id' => $this->admin->id, 'fund_cluster' => '101']);

    $this->actingAs($this->admin)
        ->delete(route('supply-transactions.destroy', $adjustment), ['reason' => 'Not needed'])
        ->assertSessionHasErrors(['reason' => 'Re-value lines are corrected from Stocks, not here.']);
});

test('only people allowed to correct transactions can', function () {
    $cao = User::factory()->cao()->create();

    $this->actingAs($cao)->put(route('supply-transactions.update', $this->receipt), ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 99, 'unit_cost' => 50, 'reason' => 'Not allowed']);
    $this->actingAs($cao)->delete(route('supply-transactions.destroy', $this->issue), ['reason' => 'Not allowed']);

    expect($this->receipt->fresh()->quantity)->toBe(10)
        ->and(SupplyTransaction::count())->toBe(2)
        ->and($this->admin->hasPermission('transactions.update'))->toBeTrue()
        ->and($cao->hasPermission('transactions.update'))->toBeFalse();
});

test('saving without changes changes nothing', function () {
    correct($this->receipt, ['transaction_date' => '2026-03-01', 'reference_no' => 'IAR 2026-03-008', 'quantity' => 10, 'unit_cost' => '50.00', 'remarks' => null])
        ->assertSessionHas('info', 'Nothing was changed.');

    expect(ActivityLog::where('module', 'transactions')->count())->toBe(0);
});
