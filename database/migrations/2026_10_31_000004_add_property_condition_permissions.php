<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Permissions for Settings › Property conditions, given to every role that
 * already has the matching Property locations permission. Locations are
 * renamed "Property locations" in the permission list, so they aren't
 * mistaken for anything else. Safe to re-run.
 */
return new class extends Migration
{
    /** condition permission => [name, the location permission it follows] */
    private const PERMISSIONS = [
        'property-conditions.view' => ['View property conditions', 'locations.view'],
        'property-conditions.create' => ['Add property conditions', 'locations.create'],
        'property-conditions.update' => ['Edit property conditions', 'locations.update'],
        'property-conditions.delete' => ['Delete property conditions', 'locations.delete'],
    ];

    private const LOCATION_NAMES = [
        'locations.view' => 'View property locations',
        'locations.create' => 'Add property locations',
        'locations.update' => 'Edit property locations',
        'locations.delete' => 'Delete property locations',
    ];

    public function up(): void
    {
        foreach (self::LOCATION_NAMES as $slug => $name) {
            DB::table('permissions')->where('slug', $slug)->update(['name' => $name, 'group' => 'Property locations']);
        }

        foreach (self::PERMISSIONS as $slug => [$name, $follows]) {
            if (! DB::table('permissions')->where('slug', $slug)->exists()) {
                DB::table('permissions')->insert([
                    'name' => $name,
                    'slug' => $slug,
                    'group' => 'Property conditions',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $permissionId = DB::table('permissions')->where('slug', $slug)->value('id');
            $followsId = DB::table('permissions')->where('slug', $follows)->value('id');

            if ($followsId === null) {
                continue;
            }

            DB::table('permission_role')->insertOrIgnore(
                DB::table('permission_role')
                    ->where('permission_id', $followsId)
                    ->pluck('role_id')
                    ->map(fn ($roleId) => ['permission_id' => $permissionId, 'role_id' => $roleId])
                    ->all(),
            );
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->delete();
        DB::table('permissions')->whereIn('slug', array_keys(self::LOCATION_NAMES))->update(['group' => 'Locations']);
    }
};
