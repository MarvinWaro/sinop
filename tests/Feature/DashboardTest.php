<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('staff are sent to the staff dashboard', function () {
    $this->actingAs(User::factory()->create());

    $this->get(route('dashboard'))->assertRedirect('/staff-dashboard');
});

test('staff can visit the staff dashboard', function () {
    $this->actingAs(User::factory()->create());

    $this->get(route('staff.dashboard'))->assertOk();
});

test('admins can visit the dashboard', function () {
    // The admin dashboard charts use MySQL/MariaDB date functions
    // (YEAR(), MONTH()), so this test only runs against MySQL/MariaDB.
    if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'])) {
        $this->markTestSkipped('The admin dashboard queries require MySQL or MariaDB.');
    }

    $this->actingAs(User::factory()->admin()->create());

    $this->get(route('dashboard'))->assertOk();
});

test('admins in user mode can not open admin pages', function () {
    $this->actingAs(User::factory()->admin()->create());

    $this->withSession(['admin_user_mode' => true])
        ->get(route('supplies.index'))
        ->assertRedirect(route('admin.user-dashboard'));
});

test('admins can visit the assets dashboard', function () {
    $this->actingAs(User::factory()->admin()->create());

    $this->get(route('assets.dashboard'))->assertOk();
});

test('admins can visit the requisitions list with the manual entry supplies', function (bool $showAll) {
    $this->actingAs(User::factory()->admin()->create());

    $this->get(route('ris.index', $showAll ? ['show_all_supplies' => 1] : []))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('ris/index')->has('availableSupplies'));
})->with([false, true]);
