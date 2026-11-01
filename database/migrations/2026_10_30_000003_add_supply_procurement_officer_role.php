<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Supply and Procurement Officer: runs the supply office day to day (IARs,
 * issuing, supplies, suppliers, properties, reports), close to Admin. What
 * stays with Admin is account security, the audit trail, the RIS signatory,
 * deleting records that carry money or accountability history, and the
 * organisation structure (divisions, designations). Approving RIS stays with
 * the CAO, so the person who issues supplies doesn't also approve them.
 *
 * Nobody is given the role here; an Administrator assigns it under Users.
 * Insert-if-missing only: safe on any copy of the database and to run again.
 */
return new class extends Migration
{
    private const SLUG = 'supply-officer';

    /** Everything else in the permission list is given to the role. */
    private const ADMIN_ONLY = [
        // Approving is the CAO's sign-off (separation of duties).
        'ris.approve',
        // Accounts, roles, audit trail, signatory.
        'users.create', 'users.update', 'users.reset-password',
        'roles.view', 'roles.create', 'roles.update', 'roles.delete',
        'activity-logs.view',
        'settings.ris-signatory',
        // Deleting records that carry money or accountability history, and
        // correcting recorded transactions (added 2026-10-31).
        'stocks.delete', 'supplies.delete', 'properties.delete',
        'transactions.update', 'transactions.delete',
        // Organisation structure (tied to accounts); viewing stays allowed.
        'divisions.create', 'divisions.update', 'divisions.delete',
        'designations.create', 'designations.update', 'designations.delete',
    ];

    public function up(): void
    {
        if (! DB::table('roles')->where('slug', self::SLUG)->exists()) {
            DB::table('roles')->insert([
                'name' => 'Supply and Procurement Officer',
                'slug' => self::SLUG,
                'description' => 'Runs the supply office: records IARs, issues approved requisitions, keeps supplies, suppliers and properties, and runs reports. Account security, the activity log, deletions and approving stay with Admin and the CAO.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $roleId = DB::table('roles')->where('slug', self::SLUG)->value('id');

        DB::table('permission_role')->insertOrIgnore(
            DB::table('permissions')
                ->whereNotIn('slug', self::ADMIN_ONLY)
                ->pluck('id')
                ->map(fn ($permissionId) => ['permission_id' => $permissionId, 'role_id' => $roleId])
                ->all(),
        );
    }

    /** Removes the role only while nobody holds it. */
    public function down(): void
    {
        $roleId = DB::table('roles')->where('slug', self::SLUG)->value('id');

        if ($roleId === null || DB::table('role_user')->where('role_id', $roleId)->exists()) {
            return;
        }

        DB::table('permission_role')->where('role_id', $roleId)->delete();
        DB::table('roles')->where('id', $roleId)->delete();
    }
};
