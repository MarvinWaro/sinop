<?php

use App\Models\ActivityLog;
use App\Models\AppSetting;
use App\Models\Category;
use App\Models\Permission;
use App\Models\RisSlip;
use App\Models\Role;
use App\Models\User;
use App\Support\RisSignatory;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

function seedMigration(): object
{
    return require database_path('migrations/2026_10_30_000001_seed_default_roles_and_permissions.php');
}

function roleId(string $slug): int
{
    return Role::query()->where('slug', $slug)->value('id');
}

test('the roles migration fills in roles from users.role and is safe to run again', function () {
    $admin = User::factory()->admin()->create();
    $cao = User::factory()->cao()->create();
    $staff = User::factory()->create();
    $odd = User::factory()->create(['role' => 'something-else']);

    // As on the production copy: accounts exist, nobody has a role yet.
    DB::table('role_user')->delete();

    seedMigration()->up();
    seedMigration()->up(); // a second run adds nothing and fails on nothing

    // 61 seeded, plus the 4 property-condition permissions,
    // messages.office and transactions.update/delete added later.
    expect(Permission::count())->toBe(68)
        ->and(DB::table('role_user')->count())->toBe(4)
        ->and($admin->fresh()->roles->pluck('slug')->all())->toBe(['admin'])
        ->and($cao->fresh()->roles->pluck('slug')->all())->toBe(['cao'])
        ->and($staff->fresh()->roles->pluck('slug')->all())->toBe(['staff'])
        ->and($odd->fresh()->roles->pluck('slug')->all())->toBe(['staff'])
        // 47, plus the property-condition ones (the CAO keeps property locations)
        // and messages.office (the CAO approves requests).
        ->and(Role::where('slug', 'cao')->first()->permissions()->count())->toBe(52)
        ->and(Role::where('slug', 'staff')->first()->permissions()->pluck('slug')->all())->toBe(['ris.request']);
});

test('the built-in roles keep today\'s access', function () {
    $admin = User::factory()->admin()->create();
    $cao = User::factory()->cao()->create();
    $staff = User::factory()->create();

    expect($admin->can('super-admin'))->toBeTrue()
        ->and($admin->can('ris.issue'))->toBeTrue()
        ->and($admin->can('activity-logs.view'))->toBeTrue();

    // CAO: approves but doesn't issue, views stocks and users but doesn't change them.
    expect($cao->can('dashboard.view'))->toBeTrue()
        ->and($cao->can('ris.approve'))->toBeTrue()
        ->and($cao->can('ris.manual-entry'))->toBeTrue()
        ->and($cao->can('supplies.update'))->toBeTrue()
        ->and($cao->can('stocks.view'))->toBeTrue()
        ->and($cao->can('users.view'))->toBeTrue()
        ->and($cao->can('ris.issue'))->toBeFalse()
        ->and($cao->can('stocks.create'))->toBeFalse()
        ->and($cao->can('users.update'))->toBeFalse()
        ->and($cao->can('roles.view'))->toBeFalse()
        ->and($cao->can('activity-logs.view'))->toBeFalse()
        ->and($cao->can('super-admin'))->toBeFalse();

    expect($staff->can('ris.request'))->toBeTrue()
        ->and($staff->can('dashboard.view'))->toBeFalse()
        ->and($staff->can('stock-cards.view'))->toBeFalse();
});

test('staff are sent to their dashboard, refused actions say so', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertRedirect('/staff-dashboard');

    $this->actingAs(User::factory()->create())
        ->get(route('stock-cards.index'))
        ->assertRedirect(route('staff.dashboard'))
        ->assertSessionHas('error');

    $this->actingAs(User::factory()->cao()->create())
        ->from(route('stocks.index'))
        ->post(route('stocks.store'), [])
        ->assertRedirect(route('stocks.index'))
        ->assertSessionHas('error');
});

test('a custom role gives exactly its permissions', function () {
    $role = Role::create(['name' => 'Report Viewer', 'slug' => 'report-viewer']);
    $role->permissions()->sync(Permission::whereIn('slug', ['dashboard.view', 'supplies.view'])->pluck('id'));

    $user = User::factory()->create();
    $user->roles()->sync([roleId('staff'), $role->id]);
    $user->syncLegacyRole();

    $this->actingAs($user->fresh())
        ->get(route('supplies.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.roles', ['Report Viewer', 'Staff'])
            ->where('auth.permissions', fn ($permissions) => collect($permissions)->sort()->values()->all() === ['dashboard.view', 'ris.request', 'supplies.view']));

    $this->actingAs($user->fresh())
        ->from(route('supplies.index'))
        ->post(route('supplies.store'), [])
        ->assertSessionHas('error');

    expect($user->fresh()->role)->toBe('staff');
});

test('people can open their own RIS but not someone else\'s', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $division = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    $slip = RisSlip::create(['ris_no' => '2026-01-001', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $division, 'requested_by' => $owner->id, 'status' => 'draft']);

    expect($owner->can('view', $slip))->toBeTrue()
        ->and($other->can('view', $slip))->toBeFalse()
        ->and(User::factory()->cao()->create()->can('view', $slip))->toBeTrue();
});

test('the Administrator role is locked and built-in roles stay', function () {
    $admin = User::factory()->admin()->create();
    $this->actingAs($admin);

    $this->put(route('roles.update', roleId('admin')), ['name' => 'Hacked', 'permissions' => []])
        ->assertSessionHas('error');
    expect(Role::find(roleId('admin'))->name)->toBe('Administrator');

    $this->delete(route('roles.destroy', roleId('staff')))->assertSessionHas('error');
    expect(Role::whereKey(roleId('staff'))->exists())->toBeTrue();

    $this->post(route('roles.store'), [
        'name' => 'Property Custodian',
        'description' => 'Keeps properties',
        'permissions' => Permission::whereIn('slug', ['properties.view', 'properties.update'])->pluck('id')->all(),
    ])->assertSessionHasNoErrors();

    $role = Role::where('name', 'Property Custodian')->firstOrFail();
    expect($role->permissions()->count())->toBe(2)
        ->and(ActivityLog::where('module', 'roles')->where('action', 'created')->exists())->toBeTrue();

    User::factory()->create()->roles()->attach($role);
    $this->delete(route('roles.destroy', $role))->assertSessionHas('error');
    expect(Role::whereKey($role->id)->exists())->toBeTrue();
});

test('only an Administrator can give the Administrator role, and the last one keeps it', function () {
    $admin = User::factory()->admin()->create();
    $staff = User::factory()->create();
    $department = DB::table('departments')->insertGetId(['name' => 'Division', 'created_at' => now(), 'updated_at' => now()]);
    $designation = DB::table('designations')->insertGetId(['name' => 'Clerk', 'created_at' => now(), 'updated_at' => now()]);
    $payload = fn (array $roles) => ['roles' => $roles, 'department_id' => $department, 'designation_id' => $designation, 'status' => 1];

    // A user manager who isn't an Administrator.
    $manager = User::factory()->create();
    $managerRole = Role::create(['name' => 'User Manager', 'slug' => 'user-manager']);
    $managerRole->permissions()->sync(Permission::whereIn('slug', ['dashboard.view', 'users.view', 'users.update'])->pluck('id'));
    $manager->roles()->sync([$managerRole->id]);

    $this->actingAs($manager)
        ->put(route('users.update', $staff->id), $payload([roleId('admin')]))
        ->assertSessionHasErrors('roles');

    // The Administrator can give several roles at once; users.role follows.
    $this->actingAs($admin)
        ->put(route('users.update', $staff->id), $payload([roleId('staff'), roleId('cao')]))
        ->assertSessionHasNoErrors();
    expect($staff->fresh()->roles->pluck('slug')->sort()->values()->all())->toBe(['cao', 'staff'])
        ->and($staff->fresh()->role)->toBe('cao');

    // The only active Administrator can't remove their own Administrator role.
    $this->actingAs($admin)
        ->put(route('users.update', $admin->id), $payload([roleId('staff')]))
        ->assertSessionHasErrors('roles');
    expect($admin->fresh()->isSuperAdmin())->toBeTrue();
});

test('the RIS signatory comes from settings, with the old rule as fallback', function () {
    $cao = User::factory()->cao()->create(['name' => 'First CAO']);
    expect(RisSignatory::current()['name'])->toBe('First CAO');

    $chosen = User::factory()->create(['name' => 'Chosen Signatory']);
    $this->actingAs(User::factory()->admin()->create())
        ->put(route('ris-signatory.update'), ['user_id' => $chosen->id])
        ->assertSessionHasNoErrors();

    expect(AppSetting::get(AppSetting::RIS_CAO_SIGNATORY))->toBe((string) $chosen->id)
        ->and(RisSignatory::current()['name'])->toBe('Chosen Signatory')
        ->and(RisSignatory::current()['designation'])->toBe('Chief Administrative Officer')
        ->and(ActivityLog::where('module', 'settings')->exists())->toBeTrue();

    $this->actingAs($cao)->get(route('ris-signatory.edit'))->assertRedirect(route('dashboard'));
});

test('the Supply and Procurement Officer runs the supply office but not the admin-only parts', function () {
    $migration = require database_path('migrations/2026_10_30_000003_add_supply_procurement_officer_role.php');
    $migration->up(); // already run by the test database; a second run changes nothing

    $role = Role::where('slug', 'supply-officer')->sole();
    expect($role->name)->toBe('Supply and Procurement Officer')
        // 42, plus the property-condition ones (it keeps property locations)
        // and messages.office (it issues requests).
        ->and($role->permissions()->count())->toBe(47);

    $officer = User::factory()->create();
    $officer->roles()->sync([roleId('staff'), $role->id]);
    $officer->syncLegacyRole();
    $officer = $officer->fresh();

    foreach (['dashboard.view', 'stocks.create', 'stocks.update', 'stocks.beginning-balances', 'ris.issue', 'ris.manual-entry',
        'supplies.create', 'supplies.update', 'properties.create', 'properties.update', 'properties.qr',
        'suppliers.delete', 'categories.delete', 'locations.delete', 'rsmi.export', 'users.view', 'ris.request'] as $allowed) {
        expect($officer->can($allowed))->toBeTrue("officer should have {$allowed}");
    }

    foreach (['ris.approve', 'stocks.delete', 'supplies.delete', 'properties.delete', 'users.create', 'users.update',
        'users.reset-password', 'roles.view', 'activity-logs.view', 'settings.ris-signatory', 'divisions.create',
        'designations.delete', 'super-admin'] as $denied) {
        expect($officer->can($denied))->toBeFalse("officer should not have {$denied}");
    }

    // The activity log names the role, not the old "staff" column value.
    $this->actingAs($officer);
    Category::create(['name' => 'Logged by officer']);
    expect(ActivityLog::query()->latest('created_at')->latest('id')->first()->actor_role)->toBe('supply-officer');

    $this->actingAs(User::factory()->admin()->create())
        ->get(route('activity-logs.index', ['user' => $officer->id]))
        ->assertInertia(fn (Assert $page) => $page->where('logs.data.0.actor_role_label', 'Supply and Procurement Officer'));
});
