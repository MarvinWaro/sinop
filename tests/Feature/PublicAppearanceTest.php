<?php

use App\Models\User;

test('the landing and sign-in pages start dark', function (string $route) {
    $this->get(route($route))
        ->assertOk()
        ->assertSee('data-appearance-override="dark"', false)
        ->assertSee('class="dark"', false);
})->with(['home', 'login', 'register', 'password.request']);

test('the public pages keep a visitor\'s light choice', function () {
    $this->withUnencryptedCookie('public_appearance', 'light')
        ->get(route('login'))
        ->assertOk()
        ->assertSee('data-appearance-override="light"', false)
        ->assertDontSee('class="dark"', false);
});

test('app pages follow the user\'s own appearance setting', function () {
    $user = User::factory()->create(['role' => 'admin']);

    $this->actingAs($user)
        ->withUnencryptedCookie('public_appearance', 'dark')
        ->withUnencryptedCookie('appearance', 'light')
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertDontSee('data-appearance-override', false)
        ->assertDontSee('class="dark"', false);
});

test('app pages are dark until the user picks a mode', function () {
    $user = User::factory()->create(['role' => 'admin']);

    $this->actingAs($user)
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertSee('class="dark"', false);
});
