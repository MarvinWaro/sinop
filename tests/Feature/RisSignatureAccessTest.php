<?php

use App\Models\RisSlip;
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
    $this->requester = User::factory()->create(['department_id' => $this->division]);
    $this->stranger = User::factory()->create(['department_id' => $this->division]);
});

function savedSignatureOf(User $user): UserSignature
{
    $path = UploadedFile::fake()->image('sign.png', 400, 120)->store('signatures', 'public');

    return $user->signatures()->create(['name' => 'Mine', 'source' => 'drawn', 'path' => $path, 'is_default' => true]);
}

test('a signature frozen on an RIS carries its number and date, and only people who may open the RIS load it', function () {
    $saved = savedSignatureOf($this->requester);

    $this->actingAs($this->requester)->post(route('ris.store'), [
        'entity_name' => 'CHEDRO 12', 'division' => $this->division, 'office' => 'Technical Division',
        'fund_cluster' => '101', 'responsibility_center_code' => '', 'purpose' => 'Office use',
        'supplies' => [['supply_id' => 1, 'quantity' => 2]],
        'signature_type' => 'esign', 'signature' => ['id' => $saved->id, 'x' => 0.4, 'y' => 0.5, 'width' => 0.5, 'rotation' => 0],
    ])->assertSessionHasNoErrors();

    $frozen = RisSlip::sole()->signatures()->sole();
    $original = Storage::disk('public')->get($saved->path);
    $copy = Storage::disk('public')->get($frozen->path);

    // Same size, but not the same picture: the stamp is on it.
    $size = getimagesizefromstring($copy);
    expect([$size[0], $size[1]])->toBe([400, 120])
        ->and(md5($copy))->not->toBe(md5($original));

    $this->actingAs($this->requester)->get($frozen->url)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    $this->actingAs(User::factory()->cao()->create())->get($frozen->url)->assertOk();
    $this->actingAs($this->stranger)->get($frozen->url)->assertNotFound();
});

test('slips e-signed before signatures were frozen show the signer\'s current one through the RIS only', function () {
    $cao = User::factory()->cao()->create();
    $cao->forceFill(['signature_path' => savedSignatureOf($cao)->path])->save();
    $slip = RisSlip::create([
        'ris_no' => 'RIS 2025-07-122', 'ris_date' => now(), 'entity_name' => 'CHEDRO 12', 'division' => $this->division,
        'office' => 'Technical Division', 'fund_cluster' => '101', 'requested_by' => $this->requester->id,
        'requester_signature_type' => 'sgd', 'status' => 'approved',
        'approved_by' => $cao->id, 'approved_at' => now(), 'approver_signature_type' => 'esign',
    ]);

    // The requester sees the CAO's signature on their slip, not by its own link.
    $this->actingAs($this->requester)->get(route('ris.signature', [$slip, 'approved']))->assertOk();
    $this->actingAs($this->requester)->get('/files/'.$cao->signature_path)->assertNotFound();
    $this->actingAs($this->requester)->getJson(route('ris.document', $slip))
        ->assertJsonPath('signatories.approved.signature.url', route('ris.signature', [$slip, 'approved'], false));

    // A step signed by hand (SGD) has no image; strangers can't open the slip.
    $this->actingAs($this->requester)->get(route('ris.signature', [$slip, 'requested']))->assertNotFound();
    $this->actingAs($this->stranger)->get(route('ris.signature', [$slip, 'approved']))->assertRedirect();
});
