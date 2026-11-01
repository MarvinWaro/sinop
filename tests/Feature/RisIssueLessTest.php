<?php

use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\User;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $now = now();
    DB::table('supplies')->insert([
        ['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE', 'reorder_point' => 0, 'created_at' => $now, 'updated_at' => $now],
        ['supply_id' => 2, 'stock_no' => '04', 'item_name' => 'PAPER CLIP', 'unit_of_measurement' => 'BOX', 'reorder_point' => 0, 'created_at' => $now, 'updated_at' => $now],
    ]);
    DB::table('supply_stocks')->insert([
        ['supply_id' => 1, 'quantity_on_hand' => 10, 'unit_cost' => 50, 'total_cost' => 500, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => $now, 'updated_at' => $now],
        ['supply_id' => 2, 'quantity_on_hand' => 5, 'unit_cost' => 20, 'total_cost' => 100, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => $now, 'updated_at' => $now],
    ]);
    $division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => $now, 'updated_at' => $now]);

    $this->requester = User::factory()->create(['department_id' => $division]);
    $this->admin = User::factory()->admin()->create();
    $this->slip = RisSlip::create([
        'ris_no' => 'RIS 2026-10-002', 'ris_date' => $now, 'entity_name' => 'CHEDRO 12', 'division' => $division,
        'office' => 'Technical Division', 'fund_cluster' => '101', 'requested_by' => $this->requester->id,
        'requester_signature_type' => 'sgd', 'status' => 'approved',
    ]);
    foreach ([1, 2] as $supply) {
        DB::table('ris_items')->insert(['ris_id' => $this->slip->ris_id, 'supply_id' => $supply, 'quantity_requested' => 1, 'created_at' => $now, 'updated_at' => $now]);
    }
});

function issueLines(RisSlip $slip, int $clips, ?string $reason): array
{
    $items = RisItem::where('ris_id', $slip->ris_id)->orderBy('supply_id')->pluck('item_id');

    return [
        'items' => [
            ['item_id' => $items[0], 'quantity_issued' => 1, 'remarks' => null],
            ['item_id' => $items[1], 'quantity_issued' => $clips, 'remarks' => $reason],
        ],
        'received_by' => test()->requester->id,
        'signature_type' => 'sgd',
    ];
}

test('an item with stock can be issued as 0 when the remarks say why', function () {
    $this->actingAs($this->admin)
        ->post(route('ris.issue', $this->slip), issueLines($this->slip, 0, 'Reserved for the board meeting'))
        ->assertSessionHasNoErrors();

    $clips = RisItem::where('supply_id', 2)->sole();
    expect($this->slip->fresh()->status)->toBe('posted')
        ->and($clips->quantity_issued)->toBe(0)
        ->and($clips->remarks)->toBe('Reserved for the board meeting')
        ->and((int) DB::table('supply_stocks')->where('supply_id', 2)->value('quantity_on_hand'))->toBe(5)
        ->and(DB::table('supply_transactions')->where('supply_id', 2)->count())->toBe(0)
        ->and((int) DB::table('supply_stocks')->where('supply_id', 1)->value('quantity_on_hand'))->toBe(9);
});

test('holding back stock without a reason is refused', function () {
    $this->actingAs($this->admin)
        ->post(route('ris.issue', $this->slip), issueLines($this->slip, 0, ''))
        ->assertSessionHasErrors('issue_validation');

    expect($this->slip->fresh()->status)->toBe('approved')
        ->and(session('errors')->first('issue_validation'))->toContain("Item 'PAPER CLIP' - 1 can be issued but 0 is entered. Say why in its remarks.");
});
