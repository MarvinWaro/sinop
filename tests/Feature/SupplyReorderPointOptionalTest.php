<?php

use App\Models\Supply;
use App\Models\User;

test('a supply can be added without a reorder point, which is then 0', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->post(route('supplies.store'), [
            'stock_no' => '01',
            'item_name' => 'ALCOHOL',
            'unit_of_measurement' => 'PIECE',
            'reorder_point' => '',
        ])
        ->assertSessionHasNoErrors()
        ->assertSessionHas('success');

    expect(Supply::query()->sole()->reorder_point)->toBe(0);
});

test('clearing a supply\'s reorder point saves 0, and a negative one is refused', function () {
    $admin = User::factory()->admin()->create();
    $supply = Supply::query()->create(['stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE', 'reorder_point' => 5]);
    $data = ['stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'PIECE'];

    $this->actingAs($admin)
        ->put(route('supplies.update', $supply), [...$data, 'reorder_point' => ''])
        ->assertSessionHasNoErrors();

    expect($supply->fresh()->reorder_point)->toBe(0);

    $this->actingAs($admin)
        ->put(route('supplies.update', $supply), [...$data, 'reorder_point' => -1])
        ->assertSessionHasErrors('reorder_point');
});
