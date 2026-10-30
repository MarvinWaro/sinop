<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('a signature can be uploaded and replaces the old one', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('staff.requests'))
        ->post(route('signature.upload'), ['signature' => UploadedFile::fake()->image('first.png', 300, 100)])
        ->assertRedirect(route('staff.requests'));

    $first = $user->fresh()->signature_path;
    Storage::disk('public')->assertExists($first);

    $this->actingAs($user)->post(route('signature.upload'), ['signature' => UploadedFile::fake()->image('second.png', 300, 100)]);

    $second = $user->fresh()->signature_path;
    expect($second)->not->toBe($first);
    Storage::disk('public')->assertExists($second);
    Storage::disk('public')->assertMissing($first);
});

test('a signature must be an image of at most 1 MB', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('signature.upload'), ['signature' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf')])
        ->assertSessionHasErrors('signature');

    $this->actingAs($user)
        ->post(route('signature.upload'), ['signature' => UploadedFile::fake()->image('big.png')->size(1500)])
        ->assertSessionHasErrors('signature');

    expect($user->fresh()->signature_path)->toBeNull();
});
