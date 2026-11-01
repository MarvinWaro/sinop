<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * A local Administrator for testing an empty install: admin@gmail.com,
     * password "password". Skipped in production, where that password would
     * be public.
     */
    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command->warn('AdminUserSeeder skipped: its password is for local testing only.');

            return;
        }

        $admin = User::updateOrCreate(['email' => 'admin@gmail.com'], [
            'name' => 'CHED Administrator',
            'role' => 'admin',
            'status' => 1,
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
        ]);

        // The roles migration only gives roles to accounts that existed when
        // it ran, so an account seeded afterwards needs its role here.
        $admin->roles()->syncWithoutDetaching(Role::query()->where('slug', Role::SUPER_ADMIN)->pluck('id'));
    }
}
