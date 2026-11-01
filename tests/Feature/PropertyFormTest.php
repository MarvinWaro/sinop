<?php

use App\Models\Location;
use App\Models\Permission;
use App\Models\Property;
use App\Models\PropertyCondition;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/** What the Add property form sends, with the fields a test cares about. */
function propertyPayload(array $overrides = []): array
{
    return [
        'property_number' => 'ppe-2026-0001',
        'item_name' => 'Laptop',
        'quantity_per_physical_count' => 1,
        'user_id' => User::factory()->create()->id,
        'condition' => 'Serviceable',
        ...$overrides,
    ];
}

/** A custodian who may add properties but not locations. */
function custodian(): User
{
    $role = Role::create(['name' => 'Custodian', 'slug' => 'custodian']);
    $role->permissions()->attach(Permission::whereIn('slug', ['dashboard.view', 'properties.view', 'properties.create'])->pluck('id'));
    $user = User::factory()->create();
    $user->roles()->sync([$role->id]);

    return $user;
}

test('the property number is saved in capitals', function () {
    $location = Location::create(['location_name' => 'Records room']);

    $this->actingAs(User::factory()->admin()->create())
        ->post(route('property.store'), propertyPayload(['location_id' => $location->id]))
        ->assertSessionHasNoErrors();

    expect(Property::sole()->property_number)->toBe('PPE-2026-0001');
});

test('a location typed in the form is added, or matched to the one already there', function () {
    $admin = User::factory()->admin()->create();
    Location::create(['location_name' => 'Records Room']);

    $this->actingAs($admin)->post(route('property.store'), propertyPayload([
        'property_number' => 'A-1',
        'location_name' => '  supply   room ',
    ]))->assertSessionHasNoErrors();

    $this->actingAs($admin)->post(route('property.store'), propertyPayload([
        'property_number' => 'A-2',
        'location_name' => 'records room',
    ]))->assertSessionHasNoErrors();

    expect(Location::pluck('location_name')->sort()->values()->all())->toBe(['Records Room', 'supply room'])
        ->and(Property::where('property_number', 'A-1')->sole()->location->location_name)->toBe('supply room')
        ->and(Property::where('property_number', 'A-2')->sole()->location->location_name)->toBe('Records Room');
});

test('only people who may add property locations or conditions can type new ones', function () {
    $custodian = custodian();

    $this->actingAs($custodian)
        ->post(route('property.store'), propertyPayload(['location_name' => 'Annex']))
        ->assertSessionHasErrors(['location_id' => 'Ask an admin to add this property location.']);

    $location = Location::create(['location_name' => 'Records room']);
    $this->actingAs($custodian)
        ->post(route('property.store'), propertyPayload(['location_id' => $location->id, 'condition' => 'For repair']))
        ->assertSessionHasErrors(['condition' => 'Ask an admin to add this condition.']);
    // A listed condition, in any case, is fine.
    $this->actingAs($custodian)
        ->post(route('property.store'), propertyPayload(['property_number' => 'X-1', 'location_id' => $location->id, 'condition' => 'unserviceable']))
        ->assertSessionHasNoErrors();

    // Nothing was added to either list.
    expect(Location::pluck('location_name')->all())->toBe(['Records room'])
        ->and(PropertyCondition::count())->toBe(2)
        ->and(Property::sole()->condition)->toBe('Unserviceable');

    $this->actingAs(User::factory()->admin()->create())
        ->post(route('property.store'), propertyPayload(['property_number' => 'B-1']))
        ->assertSessionHasErrors(['location_id', 'location_name']);
});

test('a typed condition is added to the list; the listed spelling is kept for one already there', function () {
    $admin = User::factory()->admin()->create();
    $location = Location::create(['location_name' => 'Records room']);

    $this->actingAs($admin)->post(route('property.store'), propertyPayload([
        'property_number' => 'C-1', 'location_id' => $location->id, 'condition' => 'for  repair',
    ]))->assertSessionHasNoErrors();
    $this->actingAs($admin)->post(route('property.store'), propertyPayload([
        'property_number' => 'C-2', 'location_id' => $location->id, 'condition' => 'serviceable',
    ]))->assertSessionHasNoErrors();

    expect(PropertyCondition::orderBy('name')->pluck('name')->all())->toBe(['For repair', 'Serviceable', 'Unserviceable'])
        ->and(Property::where('property_number', 'C-1')->value('condition'))->toBe('For repair')
        ->and(Property::where('property_number', 'C-2')->value('condition'))->toBe('Serviceable');
});

test('editing uses the same rules, and the form gets the conditions', function () {
    $admin = User::factory()->admin()->create();
    $location = Location::create(['location_name' => 'Records room']);
    $property = Property::create([
        'property_number' => 'D-1', 'item_name' => 'Printer', 'location_id' => $location->id,
        'user_id' => $admin->id, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1,
    ]);

    $this->actingAs($admin)->get(route('property.create'))
        ->assertInertia(fn (Assert $page) => $page->where('conditions', ['Serviceable', 'Unserviceable'])->where('canAddLocations', true)->where('canAddConditions', true));
    $this->actingAs($admin)->get(route('property.edit', $property))
        ->assertInertia(fn (Assert $page) => $page->has('conditions', 2)->where('canAddLocations', true));

    $this->actingAs($admin)->put(route('property.update', $property), propertyPayload([
        'property_number' => 'd-1-a', 'item_name' => 'Printer', 'user_id' => $admin->id,
        'location_name' => 'Annex', 'condition' => 'Unserviceable',
    ]))->assertSessionHasNoErrors();

    $property->refresh();
    expect($property->property_number)->toBe('D-1-A')
        ->and($property->location->location_name)->toBe('Annex')
        ->and($property->condition)->toBe('Unserviceable');
});

test('the PDF sticker still downloads', function () {
    $admin = User::factory()->admin()->create();
    $location = Location::create(['location_name' => 'Records room']);
    $property = Property::create([
        'property_number' => 'E-1', 'item_name' => 'Printer', 'location_id' => $location->id,
        'user_id' => $admin->id, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1,
    ]);

    $this->actingAs($admin)->get(route('property.download-qr', $property))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    @unlink(storage_path('app/public/qrcodes/property_link_'.$property->id.'.png'));
});
