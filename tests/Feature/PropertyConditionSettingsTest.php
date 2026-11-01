<?php

use App\Models\Location;
use App\Models\Property;
use App\Models\PropertyCondition;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->location = Location::create(['location_name' => 'Records room']);
});

function propertyIn(string $condition, string $number): Property
{
    return Property::create([
        'property_number' => $number, 'item_name' => 'Printer', 'location_id' => test()->location->id,
        'user_id' => test()->admin->id, 'condition' => $condition, 'quantity_per_physical_count' => 1,
    ]);
}

test('the list shows each condition, how many properties use it, and which are built in', function () {
    PropertyCondition::create(['name' => 'For repair']);
    propertyIn('Serviceable', 'P-1');
    propertyIn('Serviceable', 'P-2');

    $this->actingAs($this->admin)->get(route('property-conditions.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/property-conditions')
            ->where('conditions.data.0', ['id' => PropertyCondition::where('name', 'For repair')->value('id'), 'name' => 'For repair', 'properties_count' => 0, 'built_in' => false])
            ->where('conditions.data.1.name', 'Serviceable')
            ->where('conditions.data.1.properties_count', 2)
            ->where('conditions.data.1.built_in', true));
});

test('a condition can be added once (in any case) and renamed, and renaming updates its properties', function () {
    $this->actingAs($this->admin)->post(route('property-conditions.store'), ['name' => '  for   repair '])->assertSessionHasNoErrors();
    $this->actingAs($this->admin)->post(route('property-conditions.store'), ['name' => 'FOR REPAIR'])->assertSessionHasErrors('name');

    $condition = PropertyCondition::where('name', 'For repair')->sole();
    $property = propertyIn('For repair', 'P-1');

    $this->actingAs($this->admin)->put(route('property-conditions.update', $condition), ['name' => 'Needs repair'])->assertSessionHasNoErrors();

    expect($condition->fresh()->name)->toBe('Needs repair')
        ->and($property->fresh()->condition)->toBe('Needs repair');
});

test('a condition in use, or a built-in one, stays', function () {
    $condition = PropertyCondition::create(['name' => 'For repair']);
    propertyIn('For repair', 'P-1');
    $serviceable = PropertyCondition::where('name', 'Serviceable')->sole();

    $this->actingAs($this->admin)->delete(route('property-conditions.destroy', $condition))->assertSessionHas('error');
    $this->actingAs($this->admin)->delete(route('property-conditions.destroy', $serviceable))->assertSessionHas('error');
    $this->actingAs($this->admin)->put(route('property-conditions.update', $serviceable), ['name' => 'Working'])->assertSessionHas('error');

    expect(PropertyCondition::count())->toBe(3)->and($serviceable->fresh()->name)->toBe('Serviceable');

    Property::query()->update(['condition' => 'Serviceable']);
    $this->actingAs($this->admin)->delete(route('property-conditions.destroy', $condition))->assertSessionHas('success');
    expect(PropertyCondition::whereKey($condition->id)->exists())->toBeFalse();
});

test('staff cannot open or change the list', function () {
    $staff = User::factory()->create();

    // Staff have no admin side: they are sent to their own dashboard.
    $this->actingAs($staff)->get(route('property-conditions.index'))->assertRedirect();
    $this->actingAs($staff)->post(route('property-conditions.store'), ['name' => 'Lost'])->assertRedirect();

    expect(PropertyCondition::where('name', 'Lost')->exists())->toBeFalse();
});
