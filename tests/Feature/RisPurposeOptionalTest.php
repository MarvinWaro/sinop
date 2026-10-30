<?php

use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'reorder_point' => 2, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_stocks')->insert(['supply_id' => 1, 'quantity_on_hand' => 10, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()]);
    $this->division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
});

test('a supply request can be sent without a purpose', function () {
    $staff = User::factory()->create(['department_id' => $this->division]);

    $this->actingAs($staff)->post(route('ris.store'), [
        'entity_name' => 'CHEDRO 12',
        'division' => $this->division,
        'office' => 'Technical Division',
        'fund_cluster' => '',
        'responsibility_center_code' => '',
        'purpose' => '',
        'supplies' => [['supply_id' => 1, 'quantity' => 2]],
        'signature_type' => 'sgd',
    ])->assertSessionHasNoErrors()->assertSessionHas('success');

    expect(RisSlip::query()->sole()->purpose)->toBeNull();
});

test('a manual RIS entry can be saved without a purpose', function () {
    $admin = User::factory()->admin()->create();
    $requester = User::factory()->create(['department_id' => $this->division]);

    $this->actingAs($admin)->post(route('ris.store-manual'), [
        'is_manual_entry' => true,
        'ris_date' => now()->toDateString(),
        'reference_no' => '',
        'entity_name' => 'CHEDRO 12',
        'division' => $this->division,
        'office' => '',
        'fund_cluster' => '',
        'responsibility_center_code' => '',
        'requested_by' => $requester->id,
        'purpose' => '',
        'final_status' => 'declined',
        'decline_reason' => 'Duplicate request.',
        'items' => [['supply_id' => 1, 'quantity_requested' => 1]],
    ])->assertSessionHasNoErrors()->assertSessionHas('success');

    expect(RisSlip::query()->sole()->purpose)->toBeNull();
});

test('a purpose is still saved when one is given', function () {
    $staff = User::factory()->create(['department_id' => $this->division]);

    $this->actingAs($staff)->post(route('ris.store'), [
        'entity_name' => 'CHEDRO 12',
        'division' => $this->division,
        'office' => 'Technical Division',
        'fund_cluster' => '',
        'responsibility_center_code' => '',
        'purpose' => 'Office use',
        'supplies' => [['supply_id' => 1, 'quantity' => 1]],
        'signature_type' => 'sgd',
    ])->assertSessionHas('success');

    expect(RisSlip::query()->sole()->purpose)->toBe('Office use');
});
