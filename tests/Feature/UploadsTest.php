<?php

use App\Models\PropertyImage;
use App\Models\User;
use App\Support\Uploads;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/*
 * Uploads go to the bucket (UPLOADS_DISK=s3); the browser loads them from
 * /files/… through the app. The bucket itself is replaced by a fake here.
 */
beforeEach(function () {
    config(['filesystems.uploads' => 's3']);
    Storage::fake('s3');
});

test('an e-signature goes to the bucket and only its owner loads it, never cached', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('signatures.store'), [
        'file' => UploadedFile::fake()->image('sign.png', 300, 100), 'name' => 'Mine', 'source' => 'uploaded',
    ])->assertOk();

    $path = $user->fresh()->signature_path;
    Storage::disk('s3')->assertExists($path);
    Storage::disk('public')->assertMissing($path);
    expect($user->fresh()->signature_url)->toBe('/files/'.$path);

    $this->actingAs($user)
        ->get('/files/'.$path)
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('Cache-Control', 'no-store, private');

    // Someone else, even with the link: as if it weren't there.
    $this->actingAs(User::factory()->admin()->create())->get('/files/'.$path)->assertNotFound();

    $this->actingAs($user)->deleteJson(route('signatures.destroy', $user->signatures()->sole()))->assertOk();
    Storage::disk('s3')->assertMissing($path);
});

test('a profile photo goes to the bucket', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('profile.update'), [
        'name' => $user->name,
        'email' => $user->email,
        'photo' => UploadedFile::fake()->image('me.jpg'),
    ])->assertSessionHasNoErrors();

    $path = $user->fresh()->profile_photo_path;
    Storage::disk('s3')->assertExists($path);
    expect($user->fresh()->avatar)->toBe('/files/'.$path)
        ->and($user->fresh()->profile_photo_url)->toBe('/files/'.$path);

    $this->actingAs($user)->delete(route('profile-photo.destroy'));
    Storage::disk('s3')->assertMissing($path);
});

test('files are only for signed-in users and only from the upload folders', function () {
    Storage::disk('s3')->put('profile-photos/a.png', 'png');
    Storage::disk('s3')->put('qrcodes/b.png', 'png');

    $this->get('/files/profile-photos/a.png')->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create());
    $this->get('/files/profile-photos/a.png')
        ->assertOk()
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, private');
    $this->get('/files/profile-photos/missing.png')->assertNotFound();
    $this->get('/files/qrcodes/b.png')->assertNotFound();
    $this->get('/files/signatures/..%2F.env')->assertNotFound();
});

test('each environment has its own folder in the bucket', function () {
    // Read from the config file itself: APP_ENV is "testing" here.
    expect(config('filesystems.disks.s3.root'))->toBe('testing');
});

test('copies on the bucket do not read the source ACL', function () {
    // Garage has no ACLs (GetObjectAcl → 501), so a copy that tried to keep
    // the source's visibility failed (signing an RIS copies the signature).
    expect(config('filesystems.disks.s3.retain_visibility'))->toBeFalse()
        ->and(config('filesystems.disks.s3.visibility'))->toBe('private');
});

test('property images use the same route', function () {
    expect((new PropertyImage(['file_path' => 'property_images/1_x.jpg']))->url)->toBe('/files/property_images/1_x.jpg');
});

test('exports get a local copy of an upload', function () {
    Storage::disk('s3')->put('signatures/a.png', 'png bytes');

    $copy = Uploads::localPath('signatures/a.png');

    expect($copy)->not->toBeNull()
        ->and(file_get_contents($copy))->toBe('png bytes')
        ->and(Uploads::localPath('signatures/missing.png'))->toBeNull()
        ->and(Uploads::localPath(null))->toBeNull();
});

test('the copy command moves old files to the bucket and checks the database', function () {
    $from = sys_get_temp_dir().'/sinop-uploads-'.uniqid();
    mkdir($from.'/signatures', 0777, true);
    file_put_contents($from.'/signatures/old.png', 'old');
    User::factory()->create(['signature_path' => 'signatures/old.png']);

    $this->artisan('sinop:copy-uploads', ['from' => $from])
        ->expectsOutputToContain('1 copied, 0 already there')
        ->expectsOutputToContain('Every file the database points to is on the disk')
        ->assertSuccessful();

    Storage::disk('s3')->assertExists('signatures/old.png');

    // Run again: nothing copied twice. A file the database names but nobody has is reported.
    User::factory()->create(['signature_path' => 'signatures/lost.png']);

    $this->artisan('sinop:copy-uploads', ['from' => $from])
        ->expectsOutputToContain('0 copied, 1 already there')
        ->expectsOutputToContain('signatures/lost.png')
        ->assertFailed();

    unlink($from.'/signatures/old.png');
    rmdir($from.'/signatures');
    rmdir($from);
});
