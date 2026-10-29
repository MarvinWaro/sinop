<?php

use App\Models\Department;
use App\Models\Designation;
use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register and wait for admin activation', function () {
    $department = Department::create(['name' => 'Administrative Division']);
    $designation = Designation::create(['name' => 'Administrative Officer']);

    $response = $this->post(route('register.store'), [
        'name' => 'Juan Dela Cruz',
        'email' => 'jdelacruz@ched.gov.ph',
        'password' => 'password',
        'password_confirmation' => 'password',
        'department_id' => $department->id,
        'designation_id' => $designation->id,
    ]);

    $this->assertGuest();
    $response->assertRedirect(route('login', absolute: false));
    $response->assertSessionHas('status');

    $user = User::where('email', 'jdelacruz@ched.gov.ph')->first();

    expect($user)->not->toBeNull();
    expect((bool) $user->status)->toBeFalse();
    expect($user->department_id)->toBe($department->id);
    expect($user->designation_id)->toBe($designation->id);
});

test('registration requires a CHED email address', function () {
    $department = Department::create(['name' => 'Administrative Division']);
    $designation = Designation::create(['name' => 'Administrative Officer']);

    $response = $this->post(route('register.store'), [
        'name' => 'Juan Dela Cruz',
        'email' => 'juan@gmail.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'department_id' => $department->id,
        'designation_id' => $designation->id,
    ]);

    $response->assertSessionHasErrors('email');
    $this->assertGuest();
});

test('registration requires a division and designation', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Juan Dela Cruz',
        'email' => 'jdelacruz@ched.gov.ph',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $response->assertSessionHasErrors(['department_id', 'designation_id']);
    $this->assertGuest();
});
