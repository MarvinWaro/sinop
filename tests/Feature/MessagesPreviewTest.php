<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the Messages preview opens for staff and the admin side, and only when signed in', function () {
    $this->get(route('messages.index'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())
        ->get(route('messages.index'))
        ->assertInertia(fn (Assert $page) => $page->component('messages/index'));

    $this->actingAs(User::factory()->admin()->create())
        ->get(route('messages.index'))
        ->assertInertia(fn (Assert $page) => $page->component('messages/index'));
});
