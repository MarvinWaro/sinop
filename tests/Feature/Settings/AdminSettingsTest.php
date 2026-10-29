<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('admins can open the users page', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->count(2)->create();

    $this->actingAs($admin)
        ->get(route('users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/users')
            ->has('users.data', 3)
            ->has('departments')
            ->has('designations'));
});

test('cao can open the users page', function () {
    $this->actingAs(User::factory()->cao()->create())
        ->get(route('users.index'))
        ->assertOk();
});

test('users page search filters by name', function () {
    $admin = User::factory()->admin()->create(['name' => 'Ada Admin']);
    User::factory()->create(['name' => 'Sam Staff']);

    $this->actingAs($admin)
        ->get(route('users.index', ['search' => 'Sam']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 1)
            ->where('users.data.0.name', 'Sam Staff')
            ->where('search', 'Sam'));
});

test('staff can not open the users page', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('users.index'))
        ->assertRedirect('/staff-dashboard');
});

test('admins in user mode can not open the users page', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->withSession(['admin_user_mode' => true])
        ->get(route('users.index'))
        ->assertRedirect(route('admin.user-dashboard'));
});

test('reference lists render inside settings', function (string $route, string $component) {
    $this->actingAs(User::factory()->admin()->create())
        ->get(route($route))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    ['departments.index', 'settings/divisions'],
    ['designations.index', 'settings/designations'],
    ['categories.index', 'settings/categories'],
    ['supplier.index', 'settings/suppliers'],
    ['location.index', 'settings/locations'],
]);
