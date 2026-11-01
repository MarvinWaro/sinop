<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Permissions to correct and delete recorded supply transactions (Supply
 * transactions › Edit / Delete). Given to no role: the Administrator, a super
 * admin, has them already; they can be given to others in Roles &
 * permissions. Insert-if-missing only, safe to re-run.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'transactions.update' => 'Correct recorded transactions',
        'transactions.delete' => 'Delete recorded transactions',
    ];

    public function up(): void
    {
        foreach (self::PERMISSIONS as $slug => $name) {
            if (! DB::table('permissions')->where('slug', $slug)->exists()) {
                DB::table('permissions')->insert([
                    'name' => $name,
                    'slug' => $slug,
                    'group' => 'Transactions',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('permissions')->whereIn('slug', array_keys(self::PERMISSIONS))->delete();
    }
};
