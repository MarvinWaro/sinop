<?php

use App\Models\RisSlip;
use App\Models\RisSlipSignature;
use App\Models\User;
use App\Models\UserSignature;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'reorder_point' => 2, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_stocks')->insert(['supply_id' => 1, 'quantity_on_hand' => 10, 'unit_cost' => 50, 'total_cost' => 500, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()]);
    $this->division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
});

/** A saved signature for this person, stored like the library stores it. */
function savedSignature(User $user): UserSignature
{
    $path = UploadedFile::fake()->image('sign.png', 300, 100)->store('signatures', 'public');

    return $user->signatures()->create(['name' => 'Mine', 'source' => 'drawn', 'path' => $path, 'is_default' => true]);
}

function placed(UserSignature $signature, array $placement = []): array
{
    return ['id' => $signature->id, 'x' => 0.4, 'y' => 0.55, 'width' => 0.5, 'rotation' => -4, ...$placement];
}

test('each step freezes the e-signature where the signer placed it', function () {
    $requester = User::factory()->create(['department_id' => $this->division]);
    $cao = User::factory()->cao()->create();
    $admin = User::factory()->admin()->create();
    [$mine, $caos, $admins] = [savedSignature($requester), savedSignature($cao), savedSignature($admin)];

    $this->actingAs($requester)->post(route('ris.store'), [
        'entity_name' => 'CHEDRO 12', 'division' => $this->division, 'office' => 'Technical Division',
        'fund_cluster' => '101', 'responsibility_center_code' => '', 'purpose' => 'Office use',
        'supplies' => [['supply_id' => 1, 'quantity' => 2]],
        'signature_type' => 'esign', 'signature' => placed($mine),
    ])->assertSessionHasNoErrors();

    $slip = RisSlip::sole();
    $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'esign', 'signature' => placed($caos, ['x' => 0.5])])->assertSessionHasNoErrors();
    $this->actingAs($admin)->post(route('ris.issue', $slip), [
        'items' => [['item_id' => $slip->items()->value('item_id'), 'quantity_issued' => 2, 'remarks' => null]],
        'received_by' => $requester->id,
        'signature_type' => 'esign', 'signature' => placed($admins, ['rotation' => 12.34]),
    ])->assertSessionHasNoErrors();
    $this->actingAs($requester)->post(route('ris.receive', $slip), ['signature_type' => 'esign', 'signature' => placed($mine, ['width' => 1])])->assertSessionHasNoErrors();

    $frozen = $slip->signatures()->get()->keyBy('step');
    expect($frozen->keys()->sort()->values()->all())->toBe(['approved', 'issued', 'received', 'requested'])
        ->and($frozen['requested']->only(['user_id', 'x', 'y', 'width', 'rotation']))->toBe(['user_id' => $requester->id, 'x' => 0.4, 'y' => 0.55, 'width' => 0.5, 'rotation' => -4.0])
        ->and($frozen['approved']->x)->toBe(0.5)
        ->and($frozen['issued']->rotation)->toBe(12.3)
        ->and($frozen['received']->width)->toBe(1.0)
        ->and($frozen->pluck('path')->unique())->toHaveCount(4);

    $frozen->each(fn (RisSlipSignature $signature) => Storage::disk('public')->assertExists($signature->path));

    // The page and the signing preview get the frozen copies.
    $this->actingAs($admin)->get(route('ris.show', $slip))
        ->assertInertia(fn ($page) => $page->has('risSlip.signatures', 4)->missing('risSlip.signatures.0.path'));
    $this->actingAs($requester)->getJson(route('ris.document', $slip))
        ->assertOk()
        ->assertJsonPath('items.0.description', 'ALCOHOL')
        ->assertJsonPath('signatories.issued.signature.url', $frozen['issued']->url)
        ->assertJsonPath('signatories.issued.signature.placement.rotation', 12.3);
});

test('changing or deleting a saved signature leaves signed forms as they were', function () {
    $cao = User::factory()->cao()->create();
    $signature = savedSignature($cao);
    $slip = RisSlip::create(['ris_no' => '2026-10-001', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $this->division, 'requested_by' => User::factory()->create()->id, 'status' => 'draft']);

    $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'esign', 'signature' => placed($signature)]);
    $this->actingAs($cao)->deleteJson(route('signatures.destroy', $signature))->assertOk();

    Storage::disk('public')->assertMissing($signature->path);
    Storage::disk('public')->assertExists($slip->signatures()->sole()->path);
});

test("an e-signature must be placed, be the signer's own and stay inside the box", function () {
    $cao = User::factory()->cao()->create();
    $mine = savedSignature($cao);
    $someoneElses = savedSignature(User::factory()->create());
    $slip = RisSlip::create(['ris_no' => '2026-10-001', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $this->division, 'requested_by' => User::factory()->create()->id, 'status' => 'draft']);
    $approve = fn (array $data) => $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'esign', ...$data]);

    $approve([])->assertSessionHasErrors(['signature' => 'Place your e-signature on the form first.']);
    $approve(['signature' => placed($someoneElses)])->assertSessionHasErrors('signature.id');
    $approve(['signature' => placed($mine, ['x' => 1.5, 'width' => 0.01, 'rotation' => 90])])
        ->assertSessionHasErrors(['signature.x', 'signature.width', 'signature.rotation']);

    expect($slip->fresh()->status)->toBe('draft');
});

test('SGD needs no signature and stores none', function () {
    $cao = User::factory()->cao()->create();
    $slip = RisSlip::create(['ris_no' => '2026-10-001', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $this->division, 'requested_by' => User::factory()->create()->id, 'status' => 'draft']);

    $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'sgd', 'signature' => ['id' => 999]])->assertSessionHasNoErrors();

    expect($slip->fresh()->status)->toBe('approved')
        ->and($slip->signatures()->count())->toBe(0);
});
