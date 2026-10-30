<?php

use App\Models\ActivityLog;
use App\Models\User;
use App\Models\UserSignature;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

function addSignature(User $user, string $name = 'Drawn signature', bool $default = false)
{
    return test()->actingAs($user)->postJson(route('signatures.store'), [
        'file' => UploadedFile::fake()->image(str($name)->slug().'.png', 300, 100),
        'name' => $name,
        'source' => 'drawn',
        'make_default' => $default,
    ]);
}

test('the first signature becomes the default and is what the RIS forms use', function () {
    $user = User::factory()->create();

    addSignature($user)
        ->assertOk()
        ->assertJsonPath('signatures.0.name', 'Drawn signature')
        ->assertJsonPath('signatures.0.is_default', true)
        ->assertJsonPath('limit', UserSignature::LIMIT)
        ->assertJsonMissingPath('signatures.0.path');

    $signature = $user->signatures()->sole();
    Storage::disk('public')->assertExists($signature->path);
    expect($user->fresh()->signature_path)->toBe($signature->path)
        ->and(ActivityLog::where('action', 'uploaded')->sole()->summary)->toBe('E-signature: Drawn signature');
});

test('another signature can be made the default, here or when it is added', function () {
    $user = User::factory()->create();
    addSignature($user, 'First');
    addSignature($user, 'Second');

    [$first, $second] = $user->signatures()->reorder('id')->get()->all();
    expect($first->is_default)->toBeTrue()->and($second->is_default)->toBeFalse();

    $this->actingAs($user)->patchJson(route('signatures.make-default', $second))
        ->assertOk()
        ->assertJsonPath('signatures.0.name', 'Second');

    expect($second->fresh()->is_default)->toBeTrue()
        ->and($first->fresh()->is_default)->toBeFalse()
        ->and($user->fresh()->signature_path)->toBe($second->path);

    addSignature($user, 'Third', default: true);
    expect($user->signatures()->where('is_default', true)->sole()->name)->toBe('Third');
});

test('deleting the default makes the newest remaining one the default', function () {
    $user = User::factory()->create();
    addSignature($user, 'First');
    addSignature($user, 'Second');
    $first = $user->signatures()->where('name', 'First')->sole();

    $this->actingAs($user)->deleteJson(route('signatures.destroy', $first))->assertOk();

    Storage::disk('public')->assertMissing($first->path);
    $second = $user->signatures()->sole();
    expect($second->is_default)->toBeTrue()
        ->and($user->fresh()->signature_path)->toBe($second->path);

    $this->actingAs($user)->deleteJson(route('signatures.destroy', $second))->assertOk()->assertJsonCount(0, 'signatures');
    expect($user->fresh()->signature_path)->toBeNull();
});

test('a signature must be a PNG of at most 1 MB, and one person keeps at most ten', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('signatures.store'), [
        'file' => UploadedFile::fake()->image('photo.jpg'), 'name' => 'Photo', 'source' => 'uploaded',
    ])->assertJsonValidationErrors('file');

    $this->actingAs($user)->postJson(route('signatures.store'), [
        'file' => UploadedFile::fake()->image('big.png')->size(1500), 'name' => 'Big', 'source' => 'uploaded',
    ])->assertJsonValidationErrors('file');

    $this->actingAs($user)->postJson(route('signatures.store'), [
        'file' => UploadedFile::fake()->image('odd.png'), 'name' => 'Odd', 'source' => 'scanned',
    ])->assertJsonValidationErrors('source');

    foreach (range(1, UserSignature::LIMIT) as $number) {
        addSignature($user, "Signature {$number}")->assertOk();
    }

    addSignature($user, 'One too many')->assertJsonValidationErrors('file');
    expect($user->signatures()->count())->toBe(UserSignature::LIMIT);
});

test("nobody can change or delete someone else's signature", function () {
    $owner = User::factory()->create();
    addSignature($owner);
    $signature = $owner->signatures()->sole();

    $other = User::factory()->create();
    $this->actingAs($other)->patchJson(route('signatures.make-default', $signature))->assertForbidden();
    $this->actingAs($other)->deleteJson(route('signatures.destroy', $signature))->assertForbidden();
    $this->actingAs($other)->getJson(route('signatures.index'))->assertOk()->assertJsonCount(0, 'signatures');

    expect($signature->fresh())->not->toBeNull();
});

test('the settings page lists the saved signatures', function () {
    $user = User::factory()->create();
    addSignature($user);

    $this->actingAs($user)->get(route('signature.edit'))
        ->assertInertia(fn ($page) => $page->component('settings/signature')
            ->has('signatures', 1)
            ->where('limit', UserSignature::LIMIT));
});
