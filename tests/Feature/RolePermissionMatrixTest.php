<?php

use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->cao = Role::where('slug', 'cao')->sole();
    $this->staff = Role::where('slug', 'staff')->sole();
});

test('the roles page has what the matrix needs: who holds roles and every permission', function () {
    User::factory()->count(2)->create();

    $this->actingAs($this->admin)->get(route('roles.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/roles')
            ->where('people.total', 3)
            ->has('people.sample', 3)
            ->has('permissionGroups'));
});

test('the matrix saves several roles at once and logs each change', function () {
    $view = Permission::where('slug', 'supplies.view')->value('id');
    $staffIds = $this->staff->permissions()->pluck('permissions.id')->all();
    $caoIds = array_values(array_diff($this->cao->permissions()->pluck('permissions.id')->all(), [$view]));

    $this->actingAs($this->admin)
        ->put(route('roles.permissions'), ['roles' => [
            ['id' => $this->staff->id, 'permissions' => [...$staffIds, $view]],
            ['id' => $this->cao->id, 'permissions' => $caoIds],
        ]])
        ->assertRedirect()
        ->assertSessionHas('success', 'Permissions for 2 roles saved.');

    expect($this->staff->permissions()->where('slug', 'supplies.view')->exists())->toBeTrue()
        ->and($this->cao->permissions()->where('slug', 'supplies.view')->exists())->toBeFalse()
        ->and(ActivityLog::where('module', 'roles')->where('action', 'updated')->count())->toBe(2);
});

test('the Administrator column can\'t be changed, and only people who may edit roles can save', function () {
    $admin = Role::where('slug', 'admin')->sole();

    $this->actingAs($this->admin)
        ->put(route('roles.permissions'), ['roles' => [['id' => $admin->id, 'permissions' => []]]])
        ->assertSessionHas('error');

    $this->actingAs(User::factory()->cao()->create())
        ->put(route('roles.permissions'), ['roles' => [['id' => $this->staff->id, 'permissions' => []]]]);

    expect($this->staff->permissions()->count())->toBeGreaterThan(0);
});
