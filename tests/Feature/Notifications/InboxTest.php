<?php

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Enums\NotificationKind;
use App\Models\Notification;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

/** Give the user a notification, $minutesAgo old. */
function noticeFor(User $user, NotificationKind $kind = NotificationKind::RisApproved, int $minutesAgo = 0, bool $read = false): Notification
{
    $entry = app(ActivityRecorder::class)->record(ActivityAction::Approved, ActivityModule::Ris, label: 'RIS 2026-10-'.Str::random(3), actorName: 'Carla CAO');

    return Notification::query()->create([
        'user_id' => $user->id,
        'kind' => $kind,
        'activity_log_id' => $entry->id,
        'created_at' => now()->subMinutes($minutesAgo),
        'read_at' => $read ? now() : null,
    ]);
}

test('the bell gets the unread count and the newest five', function () {
    $user = User::factory()->create();
    collect(range(1, 7))->each(fn (int $i) => noticeFor($user, minutesAgo: $i));
    noticeFor($user, minutesAgo: 30, read: true);

    $this->actingAs($user)->getJson(route('notifications.recent'))
        ->assertOk()
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('inbox.unread', 7)
        ->assertJsonPath('data.0.kind.code', 'ris_approved')
        ->assertJsonPath('data.0.actor.name', 'Carla CAO')
        ->assertJsonPath('data.0.sentence.before', 'approved your');

    $this->actingAs($user)->getJson(route('notifications.summary'))
        ->assertOk()
        ->assertJsonPath('unread', 7)
        ->assertJsonStructure(['unread', 'latest_at']);
});

test('notifications can be read, unread, all read and deleted by their owner only', function () {
    $user = User::factory()->create();
    $other = User::factory()->admin()->create();
    $notice = noticeFor($user);
    noticeFor($user);

    $this->actingAs($user)->patchJson(route('notifications.update', $notice), ['read' => true])
        ->assertOk()->assertJsonPath('inbox.unread', 1);
    expect($notice->fresh()->read_at)->not->toBeNull();

    $this->actingAs($user)->patchJson(route('notifications.update', $notice), ['read' => false])
        ->assertJsonPath('inbox.unread', 2);

    $this->actingAs($user)->postJson(route('notifications.read-all'))->assertJsonPath('inbox.unread', 0);

    // Not even an administrator may touch someone else's.
    $this->actingAs($other)->patchJson(route('notifications.update', $notice), ['read' => false])->assertNotFound();
    $this->actingAs($other)->deleteJson(route('notifications.destroy', $notice))->assertNotFound();

    $this->actingAs($user)->deleteJson(route('notifications.destroy', $notice))->assertOk();
    expect(Notification::query()->find($notice->id))->toBeNull();
});

test('opening a notification reads it and goes to its page', function () {
    $user = User::factory()->create();
    $notice = noticeFor($user, NotificationKind::AccountActivated);

    $this->actingAs($user)->get(route('notifications.open', $notice))->assertRedirect(route('dashboard'));
    expect($notice->fresh()->read_at)->not->toBeNull();
});

test('the page lists the person\'s own notifications with filters', function () {
    $user = User::factory()->create();
    noticeFor($user);
    noticeFor($user, NotificationKind::PropertyAssigned, read: true);
    noticeFor(User::factory()->create());

    $this->actingAs($user)->get(route('notifications.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('notifications/index')
            ->has('notifications.data', 2)
            ->has('kinds', 2)
            ->has('modules', 2));

    $this->actingAs($user)->get(route('notifications.index', ['status' => 'unread']))
        ->assertInertia(fn (Assert $page) => $page->has('notifications.data', 1));

    $this->actingAs($user)->get(route('notifications.index', ['module' => 'properties']))
        ->assertInertia(fn (Assert $page) => $page->has('notifications.data', 1)
            ->where('notifications.data.0.kind.code', 'property_assigned'));
});

test('read notifications are pruned after 90 days; unread ones stay', function () {
    $user = User::factory()->create();
    $oldRead = noticeFor($user, minutesAgo: 91 * 24 * 60, read: true);
    $oldUnread = noticeFor($user, minutesAgo: 91 * 24 * 60);
    $recentRead = noticeFor($user, minutesAgo: 10, read: true);

    $this->artisan('model:prune', ['--model' => [Notification::class]])->assertSuccessful();

    expect(Notification::query()->find($oldRead->id))->toBeNull()
        ->and(Notification::query()->find($oldUnread->id))->not->toBeNull()
        ->and(Notification::query()->find($recentRead->id))->not->toBeNull();
});

test('each person may only join their own channel', function () {
    $user = User::factory()->create();
    $channels = Broadcast::getChannels();
    $authorize = $channels['App.Models.User.{id}'];

    expect($authorize($user, $user->id))->toBeTrue()
        ->and($authorize($user, $user->id + 1))->toBeFalse();
});

test('the shared inbox prop carries the unread count', function () {
    $user = User::factory()->create();
    noticeFor($user);

    $this->actingAs($user)->get(route('notifications.index'))
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 1));
});
