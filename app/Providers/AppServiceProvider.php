<?php

namespace App\Providers;

use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\LiveUpdates;
use App\Services\ReferenceNumberService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Previously registered by ReferenceNumberServiceProvider.
        $this->app->singleton(ReferenceNumberService::class, fn () => new ReferenceNumberService);

        // One per request: the recorder remembers the entries it wrote (so a
        // notification can point at one), and live signals are collected
        // and sent once after the response.
        $this->app->scoped(ActivityRecorder::class);
        $this->app->scoped(LiveUpdates::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configurePermissions();
        $this->configureBroadcasting();
    }

    /**
     * Live updates go through Berth's Soketi app (Pusher protocol). Until its
     * values are in .env (see SKILL.md), nothing is sent and pages fall back
     * to checking now and then, instead of every save failing.
     */
    protected function configureBroadcasting(): void
    {
        $pusher = config('broadcasting.connections.pusher');

        if (config('broadcasting.default') === 'pusher'
            && (blank($pusher['key'] ?? null) || blank($pusher['secret'] ?? null) || blank($pusher['app_id'] ?? null))) {
            config(['broadcasting.default' => 'null']);
        }
    }

    /**
     * Roles and permissions: `can('ris.approve')`, the `can:` route
     * middleware and policies all ask the user's roles. The super admin
     * (Administrator role) may do everything.
     */
    protected function configurePermissions(): void
    {
        Gate::before(function (User $user, string $ability): ?bool {
            if ($user->isSuperAdmin()) {
                return true;
            }

            // Permission slugs answer directly; anything else (policies)
            // carries on to its own check.
            return $user->hasPermission($ability) ? true : null;
        });

        // Only the super admin passes (Gate::before above), e.g. running storage:link.
        Gate::define('super-admin', fn (User $user): bool => false);
    }

    /**
     * Configure default behaviors for production-ready applications.
     *
     * Note: the starter kit switches dates to CarbonImmutable and enforces a
     * stricter production password policy. Both are left out on purpose so the
     * controllers ported from the Jetstream version (which mutate Carbon
     * instances and rely on the default 8 character rule) behave exactly the
     * same as before.
     */
    protected function configureDefaults(): void
    {
        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );
    }
}
