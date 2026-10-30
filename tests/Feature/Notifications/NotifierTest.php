<?php

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Enums\NotificationKind;
use App\Models\Notification;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\LiveUpdates;
use App\Services\Notifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/** A user holding the given role (by slug), e.g. 'supply-officer'. */
function notifyUserWithRole(string $slug, array $attributes = []): User
{
    $user = User::factory()->create($attributes);
    $user->roles()->sync([Role::query()->where('slug', $slug)->value('id')]);
    $user->syncLegacyRole();

    return $user->fresh();
}

/** @return list<string> Kinds the user was told about, oldest first. */
function kindsFor(User $user): array
{
    return Notification::query()->where('user_id', $user->id)->orderBy('created_at')->orderBy('id')
        ->pluck('kind')->map(fn (NotificationKind $kind) => $kind->value)->all();
}

function draftSlip(User $requester): RisSlip
{
    $division = DB::table('departments')->insertGetId(['name' => 'Technical Division', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supplies')->insertOrIgnore(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'reorder_point' => 5, 'created_at' => now(), 'updated_at' => now()]);

    $slip = RisSlip::create([
        'ris_no' => '2026-10-118',
        'ris_date' => now(),
        'entity_name' => 'CHED',
        'division' => $division,
        'requested_by' => $requester->id,
        'status' => 'draft',
    ]);
    DB::table('ris_items')->insert(['ris_id' => $slip->ris_id, 'supply_id' => 1, 'quantity_requested' => 2, 'created_at' => now(), 'updated_at' => now()]);

    return $slip;
}

test('approving an RIS tells the requester and the issuers, never the approver', function () {
    $cao = User::factory()->cao()->create();
    $officer = notifyUserWithRole('supply-officer');
    $requester = User::factory()->create();
    $slip = draftSlip($requester);

    $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'sgd'])->assertRedirect();

    expect(kindsFor($requester))->toBe(['ris_approved'])
        ->and(kindsFor($officer))->toBe(['ris_ready_to_issue'])
        ->and(kindsFor($cao))->toBe([]);

    $notice = Notification::query()->where('user_id', $requester->id)->sole();
    expect($notice->activity->action)->toBe(ActivityAction::Approved)
        ->and($notice->subjectLabel())->toBe('RIS 2026-10-118');
});

test('declining tells only the requester', function () {
    $cao = User::factory()->cao()->create();
    $officer = notifyUserWithRole('supply-officer');
    $requester = User::factory()->create();
    $slip = draftSlip($requester);

    $this->actingAs($cao)->post(route('ris.decline', $slip), ['decline_reason' => 'Not needed this quarter.']);

    expect(kindsFor($requester))->toBe(['ris_declined'])
        ->and(kindsFor($officer))->toBe([]);
});

test('approvers hear about new requests; inactive accounts are skipped', function () {
    $cao = User::factory()->cao()->create();
    $retired = User::factory()->cao()->create(['status' => false]);
    $requester = User::factory()->create();
    $this->actingAs($requester);

    $entry = app(ActivityRecorder::class)->record(ActivityAction::Requested, ActivityModule::Ris, draftSlip($requester));
    app(Notifier::class)->risSubmitted($entry);

    expect(kindsFor($cao))->toBe(['ris_submitted'])
        ->and(kindsFor($retired))->toBe([])
        ->and(kindsFor($requester))->toBe([]);
});

test('issuing tells the receiver and the requester; receiving tells issuers and approvers', function () {
    $officer = notifyUserWithRole('supply-officer');
    $cao = User::factory()->cao()->create();
    $requester = User::factory()->create();
    $receiver = User::factory()->create();
    $slip = draftSlip($requester);
    $slip->forceFill(['status' => 'posted', 'received_by' => $receiver->id])->save();
    $notifier = app(Notifier::class);

    $this->actingAs($officer);
    $notifier->risIssued($slip, app(ActivityRecorder::class)->record(ActivityAction::Issued, ActivityModule::Ris, $slip));

    $this->actingAs($receiver);
    $notifier->risReceived(app(ActivityRecorder::class)->record(ActivityAction::Received, ActivityModule::Ris, $slip));

    expect(kindsFor($receiver))->toBe(['ris_issued'])
        ->and(kindsFor($requester))->toBe(['ris_issued'])
        ->and(kindsFor($officer))->toBe(['ris_received'])
        ->and(kindsFor($cao))->toBe(['ris_received']);
});

test('stock alerts go to supply staff once per supply until read', function () {
    $officer = notifyUserWithRole('supply-officer');
    $this->actingAs($officer);
    draftSlip(User::factory()->create());
    DB::table('supplies')->insert(['supply_id' => 2, 'stock_no' => '02', 'item_name' => 'BOND PAPER', 'unit_of_measurement' => 'REAM', 'reorder_point' => 10, 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supply_stocks')->insert([
        ['supply_id' => 1, 'quantity_on_hand' => 0, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
        ['supply_id' => 2, 'quantity_on_hand' => 4, 'status' => 'available', 'fund_cluster' => '101', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $entry = fn () => app(ActivityRecorder::class)->record(ActivityAction::Issued, ActivityModule::Ris, label: 'RIS 2026-10-118');

    app(Notifier::class)->stockLevels([1, 2], $entry());
    expect(kindsFor($officer))->toEqualCanonicalizing(['stock_out', 'stock_low']);

    // Still unread: not told again.
    app(Notifier::class)->stockLevels([1, 2], $entry());
    expect(Notification::query()->where('user_id', $officer->id)->count())->toBe(2);

    $low = Notification::query()->where('kind', 'stock_low')->sole();
    expect($low->subjectLabel())->toBe('BOND PAPER (02)');
});

test('registering tells whoever can activate accounts; activating tells the person', function () {
    $admin = User::factory()->admin()->create();
    $department = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    $designation = DB::table('designations')->insertGetId(['name' => 'Clerk', 'created_at' => now(), 'updated_at' => now()]);

    $this->post(route('register.store'), [
        'name' => 'New Person',
        'email' => 'new.person@ched.gov.ph',
        'password' => 'password-123-ABC',
        'password_confirmation' => 'password-123-ABC',
        'department_id' => $department,
        'designation_id' => $designation,
    ]);
    $newcomer = User::query()->where('email', 'new.person@ched.gov.ph')->sole();

    expect(kindsFor($admin))->toBe(['account_requested'])
        ->and(Notification::query()->where('user_id', $admin->id)->sole()->subjectLabel())->toBe('New Person');

    auth()->logout();
    $this->actingAs($admin)->put(route('users.update', $newcomer->id), [
        'roles' => [Role::query()->where('slug', 'staff')->value('id')],
        'department_id' => $department,
        'designation_id' => $designation,
        'status' => true,
    ]);

    expect(kindsFor($newcomer->fresh()))->toBe(['account_activated']);
})->skip(fn () => ! Route::has('register.store'), 'Registration is turned off.');

test('the accountable officer hears about a property assigned to them', function () {
    $admin = User::factory()->admin()->create();
    $officer = User::factory()->create();
    $location = DB::table('locations')->insertGetId(['location_name' => 'Records', 'active' => 1, 'excluded' => 0, 'created_at' => now(), 'updated_at' => now()]);
    $this->actingAs($admin);

    $property = Property::create([
        'property_number' => 'PN-2026-0142', 'item_name' => 'Laptop computer', 'location_id' => $location,
        'user_id' => $officer->id, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1, 'active' => 1, 'excluded' => 0,
    ]);
    app(Notifier::class)->propertyAssigned($property, app(ActivityRecorder::class)->latestFor($property));

    expect(kindsFor($officer))->toBe(['property_assigned'])
        ->and(kindsFor($admin))->toBe([]);
});

test('a failed live update never breaks the action', function () {
    $this->mock(LiveUpdates::class)->shouldReceive('inbox')->andThrow(new RuntimeException('Socket down'));
    $cao = User::factory()->cao()->create();
    $requester = User::factory()->create();
    $slip = draftSlip($requester);

    $this->actingAs($cao)->post(route('ris.approve', $slip), ['signature_type' => 'sgd'])
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($slip->fresh()->status)->toBe('approved');
});
