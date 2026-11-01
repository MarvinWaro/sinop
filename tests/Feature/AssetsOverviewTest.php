<?php

use App\Models\Location;
use App\Models\Property;
use App\Models\User;

test('the assets overview counts holders and lists recent properties with their first photo', function () {
    $admin = User::factory()->admin()->create();
    $holder = User::factory()->create(['name' => 'Alea Marie']);
    $location = Location::create(['location_name' => 'Records Room', 'active' => 1, 'excluded' => 0]);

    $laptop = Property::create([
        'property_number' => 'PRN-1', 'item_name' => 'Laptop', 'location_id' => $location->id,
        'user_id' => $holder->id, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1, 'fund' => 'Fund 101',
    ]);
    $laptop->images()->create(['file_path' => 'property_images/laptop.jpg']);
    Property::create([
        'property_number' => 'PRN-2', 'item_name' => 'Printer', 'location_id' => $location->id,
        'user_id' => $holder->id, 'condition' => 'Unserviceable', 'quantity_per_physical_count' => 1,
    ]);
    // Removed properties are left out.
    Property::create([
        'property_number' => 'PRN-3', 'item_name' => 'Old fan', 'location_id' => $location->id,
        'user_id' => $admin->id, 'condition' => 'Unserviceable', 'quantity_per_physical_count' => 1, 'excluded' => 1,
    ]);

    $this->actingAs($admin)
        ->get(route('assets.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('assets/dashboard')
            ->where('totalProperties', 2)
            ->where('totalHolders', 1)
            ->where('byFund', fn ($rows) => collect($rows)
                ->mapWithKeys(fn ($row) => [$row['label'] => (int) $row['total']])
                ->sortKeys()->all() === ['Fund 101' => 1, 'Unspecified' => 1])
            ->has('recentProperties', 2)
            ->where('recentProperties', function ($rows) {
                $rows = collect($rows)->keyBy('property_number');

                return $rows['PRN-1']['image_url'] === '/files/property_images/laptop.jpg'
                    && $rows['PRN-1']['holder'] === 'Alea Marie'
                    && $rows['PRN-2']['image_url'] === null
                    && $rows['PRN-2']['location'] === 'Records Room';
            }));
});
