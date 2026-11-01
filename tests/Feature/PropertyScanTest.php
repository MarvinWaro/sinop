<?php

use App\Models\Location;
use App\Models\Property;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->holder = User::factory()->create(['name' => 'Juan Dela Cruz']);
    $this->property = Property::create([
        'property_number' => 'PPE-2026-0007',
        'item_name' => 'Desktop computer',
        'serial_no' => 'SN-77',
        'acquisition_cost' => 45000,
        'remarks' => 'Kept in the server room',
        'location_id' => Location::create(['location_name' => 'Records room'])->id,
        'user_id' => $this->holder->id,
        'condition' => 'Serviceable',
        'quantity_per_physical_count' => 1,
    ]);
});

test('anyone who scans a sticker sees what the item is and who is accountable, but not its cost', function () {
    $this->get(route('property.scan', 'ppe-2026-0007'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('public/property')
            ->where('signedIn', false)
            ->where('openUrl', null)
            ->where('property.item_name', 'Desktop computer')
            ->where('property.serial_no', 'SN-77')
            ->where('property.location', 'Records room')
            ->where('property.accountable.name', 'Juan Dela Cruz')
            ->missing('property.acquisition_cost')
            ->missing('property.remarks')
            ->missing('property.photos'));
});

test('signed-in users see everything, and staff of the property office can open it', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('property.scan', 'PPE-2026-0007'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('signedIn', true)
            ->where('openUrl', null)
            ->where('property.acquisition_cost', fn ($cost) => (float) $cost === 45000.0)
            ->where('property.remarks', 'Kept in the server room')
            ->has('property.photos', 0));

    $this->actingAs(User::factory()->admin()->create())
        ->get(route('property.scan', 'PPE-2026-0007'))
        ->assertInertia(fn (Assert $page) => $page->where('openUrl', route('property.view', $this->property)));
});

test('signing in from a scanned page comes back to it', function () {
    $this->get(route('property.scan.sign-in', 'PPE-2026-0007'))->assertRedirect(route('login'));

    $this->actingAs($this->holder)
        ->get(route('property.scan.sign-in', 'PPE-2026-0007'))
        ->assertRedirect(route('property.scan', 'PPE-2026-0007'));
});

test('unknown and removed properties are not shown', function () {
    $this->get(route('property.scan', 'NOPE-1'))
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page->where('property', null)->where('propertyNumber', 'NOPE-1'));

    $this->property->update(['excluded' => 1]);
    $this->get(route('property.scan', 'PPE-2026-0007'))->assertNotFound();
});

test('scanning is rate-limited', function () {
    foreach (range(1, 60) as $ignored) {
        $this->get(route('property.scan', 'NOPE-1'));
    }

    $this->get(route('property.scan', 'NOPE-1'))->assertTooManyRequests();
});
