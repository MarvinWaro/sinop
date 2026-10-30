<?php

use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

/** A division with one issued RIS (ALCOHOL × 3) from the given requester. */
function staffDivisionWithIssuedSlip(User $requester): int
{
    $division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
    $requester->forceFill(['department_id' => $division])->save();
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'created_at' => now(), 'updated_at' => now()]);

    $slip = RisSlip::create([
        'ris_no' => now()->format('Y').'-03-001',
        'ris_date' => now()->setMonth(3)->setDay(10),
        'entity_name' => 'CHED',
        'division' => $division,
        'requested_by' => $requester->id,
        'status' => 'posted',
    ]);
    DB::table('ris_items')->insert(['ris_id' => $slip->ris_id, 'supply_id' => 1, 'quantity_requested' => 4, 'quantity_issued' => 3, 'created_at' => now(), 'updated_at' => now()]);

    return $division;
}

test('the requester dashboard shows the division analytics and recent items', function () {
    $staff = User::factory()->create();
    staffDivisionWithIssuedSlip($staff);

    $this->actingAs($staff)->get(route('staff.dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('staff/dashboard')
            ->where('department.name', 'Technical Division')
            ->where('analytics.requests', 1)
            ->where('analytics.itemsIssued', 3)
            ->where('analytics.monthly.2', 3)
            ->where('analytics.topSupplies.0.name', 'ALCOHOL')
            ->where('recentItems.0.name', 'ALCOHOL')
            ->where('recentItems.0.issued', 3)
            ->where('counts.total', 1));
});

test('each section has its own page', function () {
    $staff = User::factory()->create();

    $this->actingAs($staff)->get(route('staff.requests'))->assertInertia(fn (Assert $page) => $page
        ->component('staff/requests')
        ->has('myRequests.data')
        // The Request supply dialog's supplies load only when it opens.
        ->missing('supplies')
        ->missing('departments'));

    $this->actingAs($staff)->get(route('staff.received'))->assertInertia(fn (Assert $page) => $page->component('staff/received'));
    $this->actingAs($staff)->get(route('staff.properties'))->assertInertia(fn (Assert $page) => $page->component('staff/properties'));
});

test('the request dialog loads the supplies on demand', function () {
    $staff = User::factory()->create();
    DB::table('supplies')->insert([
        ['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'reorder_point' => 5, 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 2, 'stock_no' => '02', 'item_name' => 'BALLPEN', 'unit_of_measurement' => 'PIECE', 'reorder_point' => 0, 'created_at' => now(), 'updated_at' => now()],
    ]);
    // ALCOHOL has a row per fund cluster: the card shows the larger one.
    DB::table('supply_stocks')->insert([
        ['supply_id' => 1, 'quantity_on_hand' => 4, 'status' => 'available', 'fund_cluster' => '102', 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 1, 'quantity_on_hand' => 10, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 2, 'quantity_on_hand' => 0, 'status' => 'depleted', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->actingAs($staff)->get(route('staff.requests'))
        ->assertInertia(fn (Assert $page) => $page
            ->missing('supplies')
            ->reloadOnly(['supplies', 'departments'], fn (Assert $reload) => $reload
                ->has('supplies', 2)
                ->where('supplies.0', [
                    'supply_id' => 1,
                    'name' => 'ALCOHOL',
                    'description' => null,
                    'stock_no' => '01',
                    'unit' => 'GALLON',
                    'category' => null,
                    'reorder_point' => 5,
                    'available' => 10,
                ])
                // Out of stock comes last.
                ->where('supplies.1.name', 'BALLPEN')
                ->where('supplies.1.available', 0)));
});

test('old single-page links go to the matching page', function () {
    $staff = User::factory()->create();

    $this->actingAs($staff)->get(route('staff.dashboard', ['received' => 1]))->assertRedirect(route('staff.received'));
    $this->actingAs($staff)->get(route('staff.dashboard', ['properties' => 1]))->assertRedirect(route('staff.properties'));
    $this->actingAs($staff)->get(route('staff.dashboard', ['status' => 'draft']))->assertRedirect(route('staff.requests', ['status' => 'draft']));
});

test('admin-side users use the requester pages only in user mode', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->get(route('staff.requests'))->assertRedirect('/dashboard');

    $this->actingAs($admin)->withSession(['admin_user_mode' => true])
        ->get(route('staff.requests'))
        ->assertOk();
});
