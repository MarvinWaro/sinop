<?php

use App\Models\User;
use Illuminate\Support\Facades\Storage;

/** A signature photographed on off-white paper: grey paper, a dark stroke. */
function paperSignature(): string
{
    $image = imagecreatetruecolor(400, 160);
    imagefill($image, 0, 0, imagecolorallocate($image, 238, 236, 230));
    imagesetthickness($image, 6);
    imageline($image, 60, 110, 340, 50, imagecolorallocate($image, 20, 30, 120));
    ob_start();
    imagejpeg($image);

    return (string) ob_get_clean();
}

test('old signatures with a paper background become transparent, under a new file name', function () {
    Storage::fake('public');
    Storage::disk('public')->put('signatures/old.jpg', paperSignature());
    $user = User::factory()->create(['signature_path' => 'signatures/old.jpg']);
    $signature = $user->signatures()->create(['name' => 'Uploaded signature', 'source' => 'uploaded', 'path' => 'signatures/old.jpg', 'is_default' => true]);

    $this->artisan('sinop:clean-signatures')->expectsOutputToContain('1 cleaned, 0 already transparent')->assertSuccessful();

    $path = $signature->fresh()->path;
    Storage::disk('public')->assertMissing('signatures/old.jpg');
    Storage::disk('public')->assertExists($path);
    expect($path)->toEndWith('.png')->and($user->fresh()->signature_path)->toBe($path);

    $png = imagecreatefromstring(Storage::disk('public')->get($path));
    $alpha = fn (int $x, int $y) => imagecolorat($png, $x, $y) >> 24 & 0x7F;
    // Trimmed to the stroke (plus a little padding); the paper is gone and the ink stays.
    expect(imagesx($png))->toBeLessThan(310)
        ->and($alpha(0, 0))->toBe(127)
        ->and($alpha(imagesx($png) - 1, imagesy($png) - 1))->toBe(127)
        ->and($alpha(intdiv(imagesx($png), 2), intdiv(imagesy($png), 2)))->toBeLessThan(20);

    // Already transparent now: nothing to do the second time.
    $this->artisan('sinop:clean-signatures')->expectsOutputToContain('0 cleaned, 1 already transparent')->assertSuccessful();
    expect($signature->fresh()->path)->toBe($path);
});
