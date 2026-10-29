<?php

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Http\Middleware\RecordExport;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\RisSlip;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;

function latestEntry(): ?ActivityLog
{
    return ActivityLog::query()->latest('created_at')->latest('id')->first();
}

test('the recorder writes who acted, their role and device', function () {
    $admin = User::factory()->admin()->create(['name' => 'Ada Admin']);
    $this->actingAs($admin);

    $entry = app(ActivityRecorder::class)->record(ActivityAction::Exported, ActivityModule::Reports, label: 'RSMI');

    expect($entry)->not->toBeNull()
        ->and($entry->actor_name)->toBe('Ada Admin')
        ->and($entry->actor_role)->toBe('admin')
        ->and($entry->user_id)->toBe($admin->id)
        ->and($entry->subject_label)->toBe('RSMI');
});

test('a failing log write never breaks the action it records', function () {
    Schema::drop('activity_logs');

    $entry = app(ActivityRecorder::class)->record(ActivityAction::Created, ActivityModule::System, label: 'x');

    expect($entry)->toBeNull();
});

test('reference data creates, edits and deletes are logged with before and after', function () {
    $this->actingAs(User::factory()->admin()->create());

    $category = Category::create(['name' => 'Office Supplies']);
    expect(latestEntry()->action)->toBe(ActivityAction::Created)
        ->and(latestEntry()->module)->toBe(ActivityModule::Categories)
        ->and(latestEntry()->subject_label)->toBe('Office Supplies');

    $category->update(['name' => 'Office & Stationery']);
    expect(latestEntry()->action)->toBe(ActivityAction::Updated)
        ->and(latestEntry()->changes)->toBe(['name' => ['Office Supplies', 'Office & Stationery']]);

    $count = ActivityLog::count();
    $category->update(['name' => 'Office & Stationery']);
    expect(ActivityLog::count())->toBe($count);

    $category->delete();
    expect(latestEntry()->action)->toBe(ActivityAction::Deleted);
});

test('switching an account off is logged as deactivated', function () {
    $this->actingAs(User::factory()->admin()->create());
    $staff = User::factory()->create();

    $staff->update(['status' => false]);

    expect(latestEntry()->action)->toBe(ActivityAction::Deactivated)
        ->and(latestEntry()->module)->toBe(ActivityModule::Users);
});

test('own password changes and admin resets are told apart', function () {
    $admin = User::factory()->admin()->create();
    $staff = User::factory()->create();

    $this->actingAs($staff);
    $staff->update(['password' => 'new-password-123']);
    expect(latestEntry()->action)->toBe(ActivityAction::PasswordChanged)
        ->and(latestEntry()->module)->toBe(ActivityModule::Account);

    $this->actingAs($admin)->post(route('users.reset-password', $staff->id));
    expect(latestEntry()->action)->toBe(ActivityAction::PasswordReset)
        ->and(latestEntry()->actor_name)->toBe($admin->name)
        ->and(latestEntry()->subject_label)->toBe($staff->name);
});

test('sign-ins and failed sign-ins are logged', function () {
    $user = User::factory()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);
    expect(latestEntry()->action)->toBe(ActivityAction::Login)
        ->and(latestEntry()->user_id)->toBe($user->id);

    auth()->logout();

    $this->post(route('login.store'), ['email' => 'nobody@example.com', 'password' => 'wrong']);
    expect(latestEntry()->action)->toBe(ActivityAction::LoginFailed)
        ->and(latestEntry()->actor_name)->toBe('nobody@example.com');
});

test('approving and declining an RIS write one entry each with its items', function () {
    $admin = User::factory()->admin()->create();
    $department = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    DB::table('supplies')->insert(['supply_id' => 1, 'stock_no' => '01', 'item_name' => 'ALCOHOL', 'unit_of_measurement' => 'GALLON', 'created_at' => now(), 'updated_at' => now()]);

    $slips = collect(['RIS 2026-01-001', 'RIS 2026-01-002'])->map(function (string $number) use ($department, $admin) {
        $slip = RisSlip::create([
            'ris_no' => substr($number, 4),
            'ris_date' => now(),
            'entity_name' => 'CHED',
            'division' => $department,
            'requested_by' => $admin->id,
            'status' => 'draft',
        ]);
        DB::table('ris_items')->insert(['ris_id' => $slip->ris_id, 'supply_id' => 1, 'quantity_requested' => 2, 'created_at' => now(), 'updated_at' => now()]);

        return $slip;
    });

    $this->actingAs($admin)->post(route('ris.approve', $slips[0]), ['signature_type' => 'sgd']);
    $approved = ActivityLog::where('action', 'approved')->sole();
    expect($approved->module)->toBe(ActivityModule::Ris)
        ->and($approved->subject_label)->toBe('RIS 2026-01-001')
        ->and($approved->properties['items'][0])->toMatchArray(['item' => 'ALCOHOL (01)', 'requested' => 2]);

    $this->actingAs($admin)->post(route('ris.decline', $slips[1]), ['decline_reason' => 'Not needed this quarter.']);
    $declined = ActivityLog::where('action', 'declined')->sole();
    expect($declined->summary)->toBe('Reason: Not needed this quarter.');
});

test('exports are logged only when the file is produced', function () {
    $this->actingAs(User::factory()->admin()->create());

    $request = Request::create('/rsmi/export-excel', 'GET', ['month' => '2026-03', 'fund_cluster' => '101']);
    $route = (new Route('GET', 'rsmi/export-excel', fn () => null))->name('rsmi.export-excel')->bind($request);
    $request->setRouteResolver(fn () => $route);
    $middleware = app(RecordExport::class);

    $middleware->handle($request, fn () => response('', 500));
    expect(ActivityLog::where('action', 'exported')->count())->toBe(0);

    $middleware->handle($request, fn () => response('file'));
    expect(latestEntry()->action)->toBe(ActivityAction::Exported)
        ->and(latestEntry()->subject_label)->toBe('RSMI')
        ->and(latestEntry()->summary)->toBe('Excel · 2026-03 · Fund cluster 101');
});

test('only admins can open the activity log', function () {
    $this->actingAs(User::factory()->admin()->create())
        ->get(route('activity-logs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('settings/activity-logs')->has('logs.data'));

    $this->actingAs(User::factory()->cao()->create())
        ->get(route('activity-logs.index'))
        ->assertRedirect('/dashboard');

    $this->actingAs(User::factory()->create())
        ->get(route('activity-logs.index'))
        ->assertRedirect('/staff-dashboard');

    $this->actingAs(User::factory()->admin()->create())
        ->withSession(['admin_user_mode' => true])
        ->get(route('activity-logs.index'))
        ->assertRedirect(route('admin.user-dashboard'));
});

test('the log can be filtered by action', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);
    Category::create(['name' => 'A']);
    app(ActivityRecorder::class)->record(ActivityAction::Exported, ActivityModule::Reports, label: 'RSMI');

    $this->get(route('activity-logs.index', ['action' => 'exported']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.action', 'exported')
            ->where('logs.data.0.tone', 'output'));
});
