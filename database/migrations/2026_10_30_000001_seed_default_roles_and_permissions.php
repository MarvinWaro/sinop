<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The permission list, the three built-in roles with today's access, and each
 * existing account placed in the role matching its `users.role`.
 *
 * Safe to run on any copy of the database, and to run again: rows are only
 * added when missing, nothing is overwritten or removed. The lists are
 * written out here (not read from app code) so this migration always does
 * the same thing, whatever the code looks like later. New permissions get
 * their own migration.
 */
return new class extends Migration
{
    /** slug => [name, group] */
    private const PERMISSIONS = [
        'dashboard.view' => ['Use the admin side and open the dashboard', 'Dashboard'],
        'assets.view' => ['View the assets overview', 'Dashboard'],

        'supplies.view' => ['View supplies', 'Supplies'],
        'supplies.create' => ['Add supplies', 'Supplies'],
        'supplies.update' => ['Edit supplies', 'Supplies'],
        'supplies.delete' => ['Delete supplies', 'Supplies'],

        'stocks.view' => ['View stocks', 'Stocks (IAR)'],
        'stocks.create' => ['Record IARs (receive stock)', 'Stocks (IAR)'],
        'stocks.update' => ['Re-value stocks', 'Stocks (IAR)'],
        'stocks.delete' => ['Delete stock records', 'Stocks (IAR)'],
        'stocks.beginning-balances' => ['Create beginning balances', 'Stocks (IAR)'],

        'ris.request' => ['Request supplies and receive own requisitions', 'Requisitions (RIS)'],
        'ris.view' => ['View all requisitions', 'Requisitions (RIS)'],
        'ris.approve' => ['Approve and decline requisitions', 'Requisitions (RIS)'],
        'ris.issue' => ['Issue supplies on approved requisitions', 'Requisitions (RIS)'],
        'ris.manual-entry' => ['Record manual (past) requisitions', 'Requisitions (RIS)'],

        'transactions.view' => ['View transactions', 'Transactions'],
        'transactions.create' => ['Record manual transactions', 'Transactions'],

        'stock-cards.view' => ['View stock cards', 'Stock & ledger cards'],
        'stock-cards.export' => ['Export stock cards', 'Stock & ledger cards'],
        'ledger-cards.view' => ['View supply ledger cards', 'Stock & ledger cards'],
        'ledger-cards.export' => ['Export supply ledger cards', 'Stock & ledger cards'],

        'rsmi.view' => ['View RSMI reports and analytics', 'Reports'],
        'rsmi.export' => ['Export RSMI reports', 'Reports'],
        'rpci.view' => ['View RPCI reports', 'Reports'],
        'rpci.export' => ['Export RPCI reports', 'Reports'],

        'properties.view' => ['View properties', 'Properties'],
        'properties.create' => ['Add properties', 'Properties'],
        'properties.update' => ['Edit properties', 'Properties'],
        'properties.delete' => ['Remove properties', 'Properties'],
        'properties.qr' => ['Download property QR codes', 'Properties'],

        'divisions.view' => ['View divisions', 'Divisions'],
        'divisions.create' => ['Add divisions', 'Divisions'],
        'divisions.update' => ['Edit divisions', 'Divisions'],
        'divisions.delete' => ['Delete divisions', 'Divisions'],

        'designations.view' => ['View designations', 'Designations'],
        'designations.create' => ['Add designations', 'Designations'],
        'designations.update' => ['Edit designations', 'Designations'],
        'designations.delete' => ['Delete designations', 'Designations'],

        'categories.view' => ['View categories', 'Categories'],
        'categories.create' => ['Add categories', 'Categories'],
        'categories.update' => ['Edit categories', 'Categories'],
        'categories.delete' => ['Delete categories', 'Categories'],

        'suppliers.view' => ['View suppliers', 'Suppliers'],
        'suppliers.create' => ['Add suppliers', 'Suppliers'],
        'suppliers.update' => ['Edit suppliers', 'Suppliers'],
        'suppliers.delete' => ['Delete suppliers', 'Suppliers'],

        'locations.view' => ['View locations', 'Locations'],
        'locations.create' => ['Add locations', 'Locations'],
        'locations.update' => ['Edit locations', 'Locations'],
        'locations.delete' => ['Delete locations', 'Locations'],

        'users.view' => ['View users', 'User management'],
        'users.create' => ['Add users', 'User management'],
        'users.update' => ['Edit users and their roles', 'User management'],
        'users.reset-password' => ["Reset users' passwords", 'User management'],

        'roles.view' => ['View roles and permissions', 'Roles & permissions'],
        'roles.create' => ['Create roles', 'Roles & permissions'],
        'roles.update' => ['Edit roles', 'Roles & permissions'],
        'roles.delete' => ['Delete roles', 'Roles & permissions'],

        'settings.ris-signatory' => ['Choose the CAO signatory for RIS', 'Settings'],

        'activity-logs.view' => ['View activity logs', 'Activity logs'],
    ];

    /** slug => [name, description] */
    private const ROLES = [
        'admin' => ['Administrator', 'Full access to everything in SINOP. Locked: always has every permission.'],
        'cao' => ['CAO', 'Approves and declines requisitions, runs reports and keeps the reference lists and properties.'],
        'staff' => ['Staff', 'Requests supplies and confirms receipt of their own requisitions.'],
    ];

    /**
     * What the CAO can do today. Everything except IAR changes, issuing,
     * managing user accounts and roles, the RIS signatory and the activity log.
     * Administrator needs no list: it always has every permission.
     */
    private const CAO_EXCLUDED = [
        'stocks.create', 'stocks.update', 'stocks.delete', 'stocks.beginning-balances',
        'ris.issue',
        'users.create', 'users.update', 'users.reset-password',
        'roles.view', 'roles.create', 'roles.update', 'roles.delete',
        'settings.ris-signatory',
        'activity-logs.view',
    ];

    private const STAFF = ['ris.request'];

    public function up(): void
    {
        $now = now();

        foreach (self::PERMISSIONS as $slug => [$name, $group]) {
            if (! DB::table('permissions')->where('slug', $slug)->exists()) {
                DB::table('permissions')->insert([
                    'name' => $name, 'slug' => $slug, 'group' => $group,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        foreach (self::ROLES as $slug => [$name, $description]) {
            if (! DB::table('roles')->where('slug', $slug)->exists()) {
                DB::table('roles')->insert([
                    'name' => $name, 'slug' => $slug, 'description' => $description,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        $roles = DB::table('roles')->pluck('id', 'slug');
        $permissions = DB::table('permissions')->pluck('id', 'slug');

        $grant = function (string $role, array $slugs) use ($roles, $permissions): void {
            $rows = collect($slugs)
                ->filter(fn (string $slug) => isset($permissions[$slug]))
                ->map(fn (string $slug) => ['permission_id' => $permissions[$slug], 'role_id' => $roles[$role]])
                ->values()
                ->all();

            DB::table('permission_role')->insertOrIgnore($rows);
        };

        $grant('cao', array_values(array_diff(array_keys(self::PERMISSIONS), self::CAO_EXCLUDED)));
        $grant('staff', self::STAFF);

        // Every existing account gets the role matching its `users.role`
        // (anything unexpected is treated as staff, as the app does today).
        DB::table('users')->select(['id', 'role'])->orderBy('id')->chunk(500, function ($users) use ($roles) {
            DB::table('role_user')->insertOrIgnore($users->map(fn ($user) => [
                'role_id' => $roles[$user->role] ?? $roles['staff'],
                'user_id' => $user->id,
            ])->all());
        });
    }

    /** The tables themselves are removed by the create_rbac_tables migration. */
    public function down(): void {}
};
